import { getAdminClient } from '@/lib/db/server';
import { logger } from '@/lib/observability/logger';
import {
  getTourPackageDetail,
  matchTourPackagesForMessage,
  publicRankedPackage,
  searchTourPackagesForAccount,
} from '@/lib/travel/retrieval';
import { parseTravelerRequirements } from '@/lib/travel/matching';
import { TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE } from '@/lib/travel/types';
import type { AiExecutionContext, AiToolDefinition } from './types';

type ToolRegistry = {
  get: (name: string) => AiToolDefinition | undefined;
  register: (tool: AiToolDefinition) => void;
};

const TRAVEL_INDUSTRIES = ['travel'];

function safeError() {
  return {
    success: false as const,
    error: TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE,
  };
}

function accountIdOf(context: AiExecutionContext): string {
  return context.accountId;
}

export function registerTourPackageTools(registry: ToolRegistry): void {
  if (registry.get('searchTourPackages')) return;

registry.register({
  name: 'searchTourPackages',
  description:
    'Searches this Travel Workplace Tour Package catalog by destination, budget, duration, dates, and traveller needs. Returns only real packages that belong to the current workspace.',
  type: 'read',
  allowedIndustries: TRAVEL_INDUSTRIES,
  parameters: {
    query: {
      type: 'string',
      description: 'The traveller request in natural language.',
      required: true,
    },
    destination: {
      type: 'string',
      description: 'Destination name if already known.',
    },
    budget: {
      type: 'number',
      description: 'Maximum budget as a number, e.g. 30000.',
    },
    durationDays: {
      type: 'number',
      description: 'Requested trip length in days.',
    },
  },
  execute: async (params, context) => {
    try {
      const query = String(params.query || '').trim();
      const extras = [
        params.destination ? `destination ${params.destination}` : '',
        params.budget != null ? `budget ${params.budget}` : '',
        params.durationDays != null ? `${params.durationDays} days` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const result = await matchTourPackagesForMessage(
        getAdminClient(),
        accountIdOf(context),
        query || extras,
        extras
      );
      if (result.retrievalFailed) return safeError();
      return {
        success: true,
        data: {
          matches: result.matches.slice(0, 5).map(publicRankedPackage),
          nearMatches: result.nearMatches.slice(0, 3).map(publicRankedPackage),
          found: result.matches.length > 0,
        },
      };
    } catch (error) {
      logger.error('searchTourPackages failed', {
        component: 'tour-package-tools',
        accountId: context.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return safeError();
    }
  },
});

registry.register({
  name: 'getTourPackage',
  description:
    'Retrieves one Tour Package that belongs to the current Travel Workplace, including hotels, inclusions, and pricing.',
  type: 'read',
  allowedIndustries: TRAVEL_INDUSTRIES,
  parameters: {
    packageName: {
      type: 'string',
      description: 'Exact or partial package name.',
      required: true,
    },
  },
  execute: async (params, context) => {
    try {
      const name = String(params.packageName || '').trim();
      const requirements = parseTravelerRequirements(name);
      const rows = await searchTourPackagesForAccount(
        getAdminClient(),
        accountIdOf(context),
        { ...requirements, destination: null, query: name, packageIntent: true }
      );
      const match =
        rows.find(
          (row) => row.name.toLowerCase() === name.toLowerCase()
        ) ||
        rows.find((row) =>
          row.name.toLowerCase().includes(name.toLowerCase())
        );
      if (!match) {
        return {
          success: true,
          data: { found: false, message: 'No matching package was found.' },
        };
      }
      return { success: true, data: { found: true, package: match } };
    } catch (error) {
      logger.error('getTourPackage failed', {
        component: 'tour-package-tools',
        accountId: context.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return safeError();
    }
  },
});

registry.register({
  name: 'getTourPackagePricing',
  description:
    'Looks up occupancy pricing (adults/children) for a Tour Package in the current Travel Workplace.',
  type: 'read',
  allowedIndustries: TRAVEL_INDUSTRIES,
  parameters: {
    packageName: {
      type: 'string',
      description: 'Package name if known.',
    },
    destination: {
      type: 'string',
      description: 'Destination used to find the package.',
    },
    adults: {
      type: 'number',
      description: 'Number of adults.',
    },
    children: {
      type: 'number',
      description: 'Number of children.',
    },
  },
  execute: async (params, context) => {
    try {
      const query = [
        params.packageName,
        params.destination,
        params.adults != null ? `${params.adults} adults` : '',
        params.children != null ? `${params.children} children` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const result = await matchTourPackagesForMessage(
        getAdminClient(),
        accountIdOf(context),
        query
      );
      if (result.retrievalFailed) return safeError();
      const top = result.matches[0] || result.nearMatches[0];
      if (!top) {
        return {
          success: true,
          data: { found: false, message: 'No matching package pricing was found.' },
        };
      }
      return {
        success: true,
        data: {
          found: true,
          packageName: top.package.name,
          price: top.matchedPrice,
          currency: top.matchedCurrency,
          occupancy: top.matchedPricing,
          startingPrice: top.package.starting_price,
          priceMissing: top.matchedPrice == null,
        },
      };
    } catch (error) {
      logger.error('getTourPackagePricing failed', {
        component: 'tour-package-tools',
        accountId: context.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return safeError();
    }
  },
});

registry.register({
  name: 'getTourPackageAvailability',
  description:
    'Checks departure dates and remaining seats for Tour Packages in the current Travel Workplace.',
  type: 'read',
  allowedIndustries: TRAVEL_INDUSTRIES,
  parameters: {
    destination: {
      type: 'string',
      description: 'Destination to check.',
    },
    travelDate: {
      type: 'string',
      description: 'Requested departure date YYYY-MM-DD or month name.',
    },
    packageName: {
      type: 'string',
      description: 'Optional package name.',
    },
  },
  execute: async (params, context) => {
    try {
      const query = [
        params.packageName,
        params.destination,
        params.travelDate,
        'available',
      ]
        .filter(Boolean)
        .join(' ');
      const result = await matchTourPackagesForMessage(
        getAdminClient(),
        accountIdOf(context),
        query
      );
      if (result.retrievalFailed) return safeError();
      return {
        success: true,
        data: {
          found: result.matches.length > 0,
          departures: result.matches.slice(0, 5).map((row) => ({
            packageName: row.package.name,
            destination: row.package.destination,
            departure: row.matchedDeparture,
            validity: {
              valid_from: row.package.valid_from,
              valid_until: row.package.valid_until,
            },
          })),
        },
      };
    } catch (error) {
      logger.error('getTourPackageAvailability failed', {
        component: 'tour-package-tools',
        accountId: context.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return safeError();
    }
  },
});

registry.register({
  name: 'getTourPackageItinerary',
  description:
    'Returns day-by-day itinerary details stored for a Tour Package in the current Travel Workplace.',
  type: 'read',
  allowedIndustries: TRAVEL_INDUSTRIES,
  parameters: {
    packageName: {
      type: 'string',
      description: 'Package name if known.',
    },
    destination: {
      type: 'string',
      description: 'Destination used to find the package.',
    },
    dayNumber: {
      type: 'number',
      description: 'Specific day number, e.g. 3.',
    },
  },
  execute: async (params, context) => {
    try {
      const query = [params.packageName, params.destination, 'itinerary']
        .filter(Boolean)
        .join(' ');
      const result = await matchTourPackagesForMessage(
        getAdminClient(),
        accountIdOf(context),
        query
      );
      if (result.retrievalFailed) return safeError();
      const top = result.matches[0];
      if (!top) {
        return {
          success: true,
          data: { found: false, message: 'No matching itinerary was found.' },
        };
      }
      const dayNumber = params.dayNumber != null ? Number(params.dayNumber) : null;
      const days = dayNumber
        ? top.package.itineraries.filter((day) => day.day_number === dayNumber)
        : top.package.itineraries;
      return {
        success: true,
        data: {
          found: days.length > 0,
          packageName: top.package.name,
          itinerary: days,
        },
      };
    } catch (error) {
      logger.error('getTourPackageItinerary failed', {
        component: 'tour-package-tools',
        accountId: context.accountId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return safeError();
    }
  },
});
}

export async function loadTourPackageForId(
  context: AiExecutionContext,
  packageId: string
) {
  return getTourPackageDetail(
    getAdminClient(),
    accountIdOf(context),
    packageId
  );
}
