import { CalendlyEvent } from '../../types';

export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  schedulingUrl: string;
}

export interface CalendlyAvailabilitySlot {
  startTime: string;
  endTime: string;
  status: 'available';
}

export interface CalendlyBookingRequest {
  eventTypeId: string;
  startAt: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  notes?: string;
}

export interface CalendlyProvider {
  connect(clinicId: string, authCode: string): Promise<boolean>;
  refreshCredentials(clinicId: string): Promise<boolean>;
  listEventTypes(clinicId: string): Promise<CalendlyEventType[]>;
  getAvailableTimes(
    clinicId: string,
    eventTypeUri: string,
    startDate: string,
    endDate: string
  ): Promise<CalendlyAvailabilitySlot[]>;
  createBooking(
    clinicId: string,
    req: CalendlyBookingRequest
  ): Promise<{ bookingUri: string; inviteeUri: string }>;
  cancelBooking(
    clinicId: string,
    inviteeUri: string,
    reason?: string
  ): Promise<boolean>;
  rescheduleBooking(
    clinicId: string,
    inviteeUri: string,
    newStartAt: string
  ): Promise<{ bookingUri: string }>;
  verifyWebhook(request: Request, bodyText: string): Promise<boolean>;
  normalizeWebhook(payload: Record<string, unknown>): Promise<CalendlyEvent>;
}
