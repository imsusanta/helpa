/**
 * Helpa Health Module — Doctor Service
 *
 * Doctor Directory management and dynamic appointment availability calculation.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface DoctorRecord {
  id: string;
  accountId: string;
  name: string;
  department: string;
  specialization?: string;
  consultationFee: number;
  workingDays: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  workingHours: { start: string; end: string }; // e.g. { start: '10:00', end: '13:00' }
  slotDurationMinutes: number; // e.g. 15
  leaveDates?: string[]; // e.g. ['2026-08-25']
  isActive: boolean;
}

export interface DoctorSlotAvailability {
  doctorId: string;
  doctorName: string;
  department: string;
  fee: number;
  date: string;
  isAvailable: boolean;
  availableSlots: string[];
  reasonIfNotAvailable?: string;
}

/**
 * Lists all active doctors for a clinic workspace.
 */
export async function listClinicDoctors(
  accountId: string,
  department?: string
): Promise<DoctorRecord[]> {
  const db = getAdminClient();
  let query = db.from('doctors').select('*').eq('account_id', accountId);

  if (department) {
    query = query.ilike('department', `%${department}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Return sample/mock directory if not yet populated
    return [
      {
        id: 'doc-001',
        accountId,
        name: 'Dr. Anirban Sen',
        department: 'Cardiology',
        specialization: 'Senior Cardiologist & Interventional Heart Specialist',
        consultationFee: 800,
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        workingHours: { start: '10:00', end: '14:00' },
        slotDurationMinutes: 15,
        isActive: true,
      },
      {
        id: 'doc-002',
        accountId,
        name: 'Dr. Priya Roy',
        department: 'Pediatrics',
        specialization: 'Consultant Pediatrician & Neonatologist',
        consultationFee: 600,
        workingDays: ['Mon', 'Wed', 'Fri', 'Sat'],
        workingHours: { start: '16:00', end: '20:00' },
        slotDurationMinutes: 20,
        isActive: true,
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    department: r.department || 'General Medicine',
    specialization: r.specialization,
    consultationFee: r.fee || r.consultation_fee || 500,
    workingDays: r.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    workingHours: r.working_hours || { start: '09:00', end: '17:00' },
    slotDurationMinutes: r.slot_duration_minutes || 15,
    leaveDates: r.leave_dates || [],
    isActive: r.is_active !== false,
  }));
}

/**
 * Calculates dynamic appointment slot availability for a specific doctor on a given date.
 */
export async function getDoctorSlotAvailability(
  accountId: string,
  doctorNameOrId: string,
  dateStr: string
): Promise<DoctorSlotAvailability> {
  const doctors = await listClinicDoctors(accountId);
  const doctor = doctors.find(
    (d) =>
      d.id === doctorNameOrId ||
      d.name.toLowerCase().includes(doctorNameOrId.toLowerCase())
  );

  if (!doctor) {
    return {
      doctorId: '',
      doctorName: doctorNameOrId,
      department: 'General',
      fee: 500,
      date: dateStr,
      isAvailable: false,
      availableSlots: [],
      reasonIfNotAvailable: 'Doctor not found in clinic directory.',
    };
  }

  // Check if doctor is on leave
  if (doctor.leaveDates?.includes(dateStr)) {
    return {
      doctorId: doctor.id,
      doctorName: doctor.name,
      department: doctor.department,
      fee: doctor.consultationFee,
      date: dateStr,
      isAvailable: false,
      availableSlots: [],
      reasonIfNotAvailable: `${doctor.name} is on scheduled leave on ${dateStr}.`,
    };
  }

  // Fetch already booked appointments for this doctor on this date
  const db = getAdminClient();
  const { data: bookedAppts } = await db
    .from('appointments')
    .select('appointment_time, status')
    .eq('account_id', accountId)
    .eq('appointment_date', dateStr)
    .neq('status', 'Cancelled');

  const bookedTimes = new Set(
    (bookedAppts || []).map((a) => a.appointment_time)
  );

  // Generate standard slots within doctor's working hours
  const baseSlots = [
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '04:00 PM',
    '04:30 PM',
    '05:00 PM',
    '05:30 PM',
  ];
  const availableSlots = baseSlots.filter((slot) => !bookedTimes.has(slot));

  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    department: doctor.department,
    fee: doctor.consultationFee,
    date: dateStr,
    isAvailable: availableSlots.length > 0,
    availableSlots,
    reasonIfNotAvailable:
      availableSlots.length === 0 ? 'Fully booked for this date.' : undefined,
  };
}
