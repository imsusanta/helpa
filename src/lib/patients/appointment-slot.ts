export interface DoctorWorkingHours {
  start?: string | null;
  end?: string | null;
}

/**
 * Normalize an AI-extracted time string to HH:MM (24-hour).
 *
 * The AI extracts `time` from free text, so it can arrive as "10:00 AM",
 * "17:30", or something unusable like "morning". The appointments.time column
 * is a Postgres TIME; inserting an unparsable string fails the booking, so the
 * caller must check for null and ask the customer for a clear time instead.
 */
export function normalizeAppointmentTime(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  if (match[3] === 'pm' && hours < 12) hours += 12;
  if (match[3] === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Whether an HH:MM time falls inside the doctor's working hours.
 * Missing or unparsable bounds never block a booking — the schedule is
 * advisory data, and a data-entry mistake should not silently refuse patients.
 */
export function isWithinWorkingHours(
  time: string,
  hours: DoctorWorkingHours | null | undefined
): boolean {
  if (!hours?.start || !hours?.end) return true;
  const start = normalizeAppointmentTime(hours.start);
  const end = normalizeAppointmentTime(hours.end);
  const normalized = normalizeAppointmentTime(time);
  if (!start || !end || !normalized) return true;
  return normalized >= start && normalized <= end;
}
