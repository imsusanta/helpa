import { formatMoney } from './matching';
import type {
  TourPackageDetail,
  TourPackageItinerary,
  TourPackageMatchResult,
} from './types';
import { TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE } from './types';

export const TRAVEL_PACKAGE_SOURCE_OF_TRUTH_RULES = `[TOUR PACKAGE SOURCE OF TRUTH]
The Tour Package database for THIS Travel Workplace is the only source of truth for agency-specific package facts.
1. Never invent package names, prices, hotels, availability, departure dates, itinerary details, or inclusions/exclusions.
2. Never claim a package exists unless it appears in the Tour Package database results below.
3. If no matching package exists, say so clearly. Do not fabricate a package to satisfy the customer.
4. If package information is incomplete (for example a missing price), say that the detail needs confirmation. Do not fill gaps with general AI knowledge.
5. Generic destination advice may use general knowledge. Business-specific facts must come from the database.
6. Only recommend ACTIVE, non-expired packages. Do not recommend inactive, expired, or sold-out departures unless the traveller explicitly asks about them.
7. If a traveller budget is given, only present packages that fit that budget as recommendations. If none fit, say no exact match exists and optionally mention real higher/lower options from the database.
8. If retrieval failed, say exactly: "${TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE}"
9. Never expose SQL, database errors, API keys, internal IDs, or stack traces.`;

export function formatTourPackageFactSheet(pkg: TourPackageDetail): string {
  const duration = `${pkg.duration_days} Days / ${pkg.duration_nights} Nights`;
  const price = formatMoney(pkg.starting_price, pkg.currency);
  const lines = [
    `Package: ${pkg.name}`,
    `Destination: ${pkg.destination}`,
    `Duration: ${duration}`,
    `Type: ${pkg.package_type || 'Not specified'}`,
    `Category: ${pkg.category || 'Not specified'}`,
    `Starting price: ${price || 'Not listed — confirm with the agency'}`,
    `Price type: ${pkg.price_type || 'Not specified'}`,
    `Status: ${pkg.status}`,
    `Featured: ${pkg.featured ? 'yes' : 'no'}`,
    `Validity: ${pkg.valid_from || 'n/a'} to ${pkg.valid_until || 'n/a'}`,
  ];
  if (pkg.description) lines.push(`Description: ${pkg.description}`);
  if (pkg.inclusions.length) {
    lines.push(`Inclusions: ${pkg.inclusions.map((row) => row.item).join('; ')}`);
  }
  if (pkg.exclusions.length) {
    lines.push(`Exclusions: ${pkg.exclusions.map((row) => row.item).join('; ')}`);
  }
  if (pkg.hotels.length) {
    lines.push(
      `Hotels: ${pkg.hotels
        .map(
          (hotel) =>
            `${hotel.hotel_name}${hotel.city ? ` (${hotel.city})` : ''}${hotel.star_category ? `, ${hotel.star_category}` : ''}${hotel.meal_plan ? `, ${hotel.meal_plan}` : ''}`
        )
        .join('; ')}`
    );
  }
  return lines.join('\n');
}

export function formatItineraryDay(day: TourPackageItinerary): string {
  return [
    `Day ${day.day_number}${day.title ? `: ${day.title}` : ''}`,
    day.description ? `Description: ${day.description}` : null,
    day.activities ? `Activities: ${day.activities}` : null,
    day.meals ? `Meals: ${day.meals}` : null,
    day.hotel ? `Hotel: ${day.hotel}` : null,
    day.overnight_location ? `Overnight: ${day.overnight_location}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTravelPackagePromptBlock(
  result: TourPackageMatchResult
): string {
  if (result.retrievalFailed) {
    return `\n\n=== TRAVEL WORKPLACE TOUR PACKAGES ===\nRETRIEVAL ERROR: Database lookup failed.\nYou MUST reply with: "${TOUR_PACKAGE_RETRIEVAL_UNAVAILABLE}"\nDo not estimate or invent package details.\n`;
  }

  if (!result.requirements.packageIntent) {
    return '';
  }

  const lines = [
    '',
    '=== TRAVEL WORKPLACE TOUR PACKAGES (CURRENT ACCOUNT ONLY) ===',
    TRAVEL_PACKAGE_SOURCE_OF_TRUTH_RULES,
    `Detected requirements: destination=${result.requirements.destination || 'n/a'}, budget=${result.requirements.budget ?? 'n/a'}, duration_days=${result.requirements.durationDays ?? 'n/a'}, adults=${result.requirements.adults ?? 'n/a'}, children=${result.requirements.children ?? 'n/a'}, date=${result.requirements.travelDate || result.requirements.travelMonth || 'n/a'}, type=${result.requirements.packageType || 'n/a'}.`,
  ];

  if (result.matches.length === 0 && result.nearMatches.length === 0) {
    lines.push(
      'No matching Tour Package was found in this Travel Workplace database.',
      'Tell the customer that no matching package was found or that the information needs confirmation.',
      'Do not invent a package.'
    );
    return `${lines.join('\n')}\n`;
  }

  if (result.matches.length > 0) {
    lines.push('RECOMMENDED PACKAGES THAT EXIST IN THE DATABASE:');
    result.matches.slice(0, 5).forEach((row, index) => {
      lines.push(`--- Match ${index + 1} ---`);
      lines.push(formatTourPackageFactSheet(row.package));
      if (row.matchedPrice != null) {
        lines.push(
          `Matched price: ${formatMoney(row.matchedPrice, row.matchedCurrency || row.package.currency)}`
        );
      }
      if (row.matchedPricing) {
        lines.push(
          `Occupancy price: ${row.matchedPricing.adults} adults + ${row.matchedPricing.children} children = ${formatMoney(row.matchedPricing.price, row.matchedPricing.currency)}`
        );
      }
      if (row.matchedDeparture) {
        lines.push(
          `Departure: ${row.matchedDeparture.departure_date} (${row.matchedDeparture.available_seats ?? 'n/a'} seats, ${row.matchedDeparture.status})`
        );
      }
      if (result.requirements.itineraryDay) {
        const day = row.package.itineraries.find(
          (item) => item.day_number === result.requirements.itineraryDay
        );
        lines.push(
          day
            ? formatItineraryDay(day)
            : `Day ${result.requirements.itineraryDay} itinerary is not listed for this package.`
        );
      }
      lines.push(`Match reasons: ${row.reasons.join(', ') || 'workspace catalog'}`);
    });
  } else if (result.nearMatches.length > 0 && result.requirements.budget != null) {
    const options = result.nearMatches
      .map((row) =>
        formatMoney(row.matchedPrice, row.matchedCurrency || row.package.currency)
      )
      .filter(Boolean);
    lines.push(
      `No exact package currently matches the ₹${result.requirements.budget.toLocaleString('en-IN')} budget.`,
      `Real database options from this workplace: ${options.join(' and ') || 'prices need confirmation'}.`,
      'Ask if the traveller wants to see those real options. Do not invent a mid-budget package.'
    );
    result.nearMatches.slice(0, 3).forEach((row, index) => {
      lines.push(`--- Over-budget option ${index + 1} ---`);
      lines.push(formatTourPackageFactSheet(row.package));
    });
  }

  return `${lines.join('\n')}\n`;
}
