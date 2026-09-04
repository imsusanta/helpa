import type { IndustryAdapter } from './industry-adapter.interface';

const TRAVEL_RULES = `TRAVEL BOOKING CONFIRM:
If the traveller asks to confirm a booking (including "booking confirm" / "confirm booking"), always emit TOOL_CALL: {"name":"offerTravelBookingConfirm","arguments":{"packageName":"<name if known>"}} so the Confirm Booking button is sent on WhatsApp. Do not ask which package first, and do not say the booking is completed until the button click or confirmTravelBooking succeeds.`;

const TRAVEL_PACKAGE_POLICY = `[TRAVEL PACKAGE BEHAVIOR]
- The Tour Package database for this Travel Workplace is the source of truth for agency-specific package names, prices, hotels, itineraries, inclusions, exclusions, departures, and availability.
- Never invent those facts. If the database has no match, say that no matching package was found or that the information needs confirmation.
- Recommend only active, non-expired packages that actually fit the traveller's budget and dates.
- Generic destination advice may use general knowledge. Business-specific package facts must come from the retrieved workspace data.
- When the traveller wants to confirm a booking, send the Booking Confirm template with offerTravelBookingConfirm. Do not claim the booking is done until the Confirm Booking button or confirmTravelBooking succeeds.`;

export class TravelAdapter implements IndustryAdapter {
  readonly id = 'travel';
  readonly industryIds = ['travel'] as const;

  getPromptRules(): string {
    return TRAVEL_RULES;
  }

  getOverrideRules(): string {
    return '';
  }

  getJsonSchemaFields(): string[] {
    return [];
  }

  getIntentPolicy(): string {
    return TRAVEL_PACKAGE_POLICY;
  }

  getContextSectionHeader(): string {
    return '=== TRAVEL WORKPLACE TOUR PACKAGE CONTEXT ===';
  }
}

export const travelAdapter = new TravelAdapter();
