import {
  resolveIndustryAlias,
  type CanonicalIndustry,
} from '@/core/modules/terminology';

export type BookingFieldVisibility = { show: boolean; required: boolean };

export type BookingFormConfig = Record<string, BookingFieldVisibility>;

export type BookingFieldCategory =
  | 'primary'
  | 'schedule'
  | 'details'
  | 'patient_info'
  | 'guardian'
  | 'clinical'
  | 'insurance';

export type BookingFieldInput =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'phone'
  | 'package'
  | 'provider';

export interface BookingFieldMeta {
  key: string;
  label: string;
  category: BookingFieldCategory;
  description: string;
  input: BookingFieldInput;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

const VISIBLE = { show: true, required: false } as const;
const REQUIRED = { show: true, required: true } as const;
const HIDDEN = { show: false, required: false } as const;

/** Clinic-oriented defaults kept for backward-compatible imports. */
export const DEFAULT_BOOKING_FORM_CONFIG: BookingFormConfig = {
  name: REQUIRED,
  phone: REQUIRED,
  age: VISIBLE,
  gender: VISIBLE,
  dob: VISIBLE,
  address: VISIBLE,
  blood_group: VISIBLE,
  emergency_contact: HIDDEN,
  guardian_name: HIDDEN,
  guardian_mobile: HIDDEN,
  email: HIDDEN,
  doctor_id: VISIBLE,
  department: VISIBLE,
  appointment_type: HIDDEN,
  reason_for_visit: HIDDEN,
  insurance_provider: HIDDEN,
  insurance_number: HIDDEN,
  referred_by: HIDDEN,
  notes: VISIBLE,
};

const CLINIC_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Patient Name',
    category: 'primary',
    description: 'Full name of the patient',
    input: 'text',
    placeholder: 'Enter full patient name...',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'Primary contact and WhatsApp number',
    input: 'phone',
  },
  {
    key: 'age',
    label: 'Age',
    category: 'patient_info',
    description: 'Patient age in years',
    input: 'number',
    placeholder: 'e.g. 35',
  },
  {
    key: 'gender',
    label: 'Gender',
    category: 'patient_info',
    description: 'Male, Female, or Other',
    input: 'select',
    options: [
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
      { value: 'Other', label: 'Other' },
    ],
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    category: 'patient_info',
    description: 'Exact birth date',
    input: 'date',
  },
  {
    key: 'address',
    label: 'Address',
    category: 'patient_info',
    description: 'Residential location / city',
    input: 'text',
    placeholder: 'City / Area / Full Address',
  },
  {
    key: 'blood_group',
    label: 'Blood Group',
    category: 'patient_info',
    description: 'A+, B+, O+, AB+, etc.',
    input: 'select',
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => ({
      value: bg,
      label: bg,
    })),
  },
  {
    key: 'emergency_contact',
    label: 'Emergency Contact',
    category: 'patient_info',
    description: 'ICE contact name and mobile',
    input: 'text',
  },
  {
    key: 'guardian_name',
    label: 'Guardian Name',
    category: 'guardian',
    description: 'Parent or legal guardian name',
    input: 'text',
  },
  {
    key: 'guardian_mobile',
    label: 'Guardian Mobile',
    category: 'guardian',
    description: 'Parent or legal guardian mobile',
    input: 'text',
  },
  {
    key: 'email',
    label: 'Email Address',
    category: 'patient_info',
    description: 'Email for digital invoices',
    input: 'text',
  },
  {
    key: 'doctor_id',
    label: 'Preferred Doctor',
    category: 'clinical',
    description: 'Attending consultant doctor',
    input: 'provider',
  },
  {
    key: 'department',
    label: 'Department',
    category: 'clinical',
    description: 'Cardiology, Orthopedics, OPD, etc.',
    input: 'text',
    placeholder: 'e.g. Cardiology, Orthopedics, General OPD',
  },
  {
    key: 'appointment_type',
    label: 'Appointment Type',
    category: 'clinical',
    description: 'New Consultation, Follow-up, Check-up',
    input: 'text',
  },
  {
    key: 'reason_for_visit',
    label: 'Reason for Visit',
    category: 'clinical',
    description: 'Primary chief complaint or symptoms',
    input: 'text',
  },
  {
    key: 'insurance_provider',
    label: 'Insurance Provider',
    category: 'insurance',
    description: 'TPA / Health Insurance company',
    input: 'text',
  },
  {
    key: 'insurance_number',
    label: 'Insurance Policy Number',
    category: 'insurance',
    description: 'Policy or TPA Card ID',
    input: 'text',
  },
  {
    key: 'referred_by',
    label: 'Referred By',
    category: 'clinical',
    description: 'Referring doctor or channel',
    input: 'text',
  },
  {
    key: 'notes',
    label: 'Internal Staff Notes',
    category: 'clinical',
    description: 'Receptionist and triage notes',
    input: 'text',
  },
];

const TRAVEL_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Traveller Name',
    category: 'primary',
    description: 'Lead traveller full name',
    input: 'text',
    placeholder: 'Enter traveller name...',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'WhatsApp / contact number',
    input: 'phone',
  },
  {
    key: 'email',
    label: 'Email',
    category: 'details',
    description: 'Optional email for itinerary updates',
    input: 'text',
    placeholder: 'traveller@email.com',
  },
  {
    key: 'package_id',
    label: 'Tour Package',
    category: 'details',
    description: 'Package being booked',
    input: 'package',
  },
  {
    key: 'destination',
    label: 'Destination',
    category: 'details',
    description: 'City or region for the trip',
    input: 'text',
    placeholder: 'e.g. Kashmir, Goa, Bali',
  },
  {
    key: 'travel_date',
    label: 'Travel Date',
    category: 'schedule',
    description: 'Departure / travel start date',
    input: 'date',
  },
  {
    key: 'guests_count',
    label: 'Guests',
    category: 'details',
    description: 'Number of travellers',
    input: 'number',
    placeholder: 'e.g. 2',
  },
  {
    key: 'total_price',
    label: 'Total Price (₹)',
    category: 'details',
    description: 'Quoted or confirmed package total',
    input: 'number',
    placeholder: 'e.g. 27999',
  },
  {
    key: 'notes',
    label: 'Booking Notes',
    category: 'details',
    description: 'Special requests, pickup, or staff notes',
    input: 'text',
  },
];

const RESTAURANT_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Guest Name',
    category: 'primary',
    description: 'Name for the reservation',
    input: 'text',
    placeholder: 'Enter guest name...',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'WhatsApp / contact number',
    input: 'phone',
  },
  {
    key: 'guests_count',
    label: 'Party Size',
    category: 'details',
    description: 'Number of guests',
    input: 'number',
    placeholder: 'e.g. 4',
  },
  {
    key: 'appointment_date',
    label: 'Reservation Date',
    category: 'schedule',
    description: 'Date of the reservation',
    input: 'date',
  },
  {
    key: 'appointment_time',
    label: 'Reservation Time',
    category: 'schedule',
    description: 'Arrival time',
    input: 'time',
  },
  {
    key: 'notes',
    label: 'Special Requests',
    category: 'details',
    description: 'Seating, occasion, or dietary notes',
    input: 'text',
  },
];

const SALON_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Client Name',
    category: 'primary',
    description: 'Client full name',
    input: 'text',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'WhatsApp / contact number',
    input: 'phone',
  },
  {
    key: 'service',
    label: 'Service',
    category: 'details',
    description: 'Haircut, colour, spa treatment, etc.',
    input: 'text',
    placeholder: 'e.g. Haircut & colour',
  },
  {
    key: 'doctor_id',
    label: 'Stylist',
    category: 'details',
    description: 'Preferred stylist',
    input: 'provider',
  },
  {
    key: 'appointment_date',
    label: 'Appointment Date',
    category: 'schedule',
    description: 'Visit date',
    input: 'date',
  },
  {
    key: 'appointment_time',
    label: 'Appointment Time',
    category: 'schedule',
    description: 'Visit time',
    input: 'time',
  },
  {
    key: 'notes',
    label: 'Notes',
    category: 'details',
    description: 'Allergies, preferences, or staff notes',
    input: 'text',
  },
];

const GYM_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Member Name',
    category: 'primary',
    description: 'Member full name',
    input: 'text',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'WhatsApp / contact number',
    input: 'phone',
  },
  {
    key: 'service',
    label: 'Session / Class',
    category: 'details',
    description: 'Personal training, yoga, HIIT, etc.',
    input: 'text',
  },
  {
    key: 'doctor_id',
    label: 'Trainer',
    category: 'details',
    description: 'Preferred trainer',
    input: 'provider',
  },
  {
    key: 'appointment_date',
    label: 'Session Date',
    category: 'schedule',
    description: 'Training date',
    input: 'date',
  },
  {
    key: 'appointment_time',
    label: 'Session Time',
    category: 'schedule',
    description: 'Training time',
    input: 'time',
  },
  {
    key: 'notes',
    label: 'Notes',
    category: 'details',
    description: 'Goals or staff notes',
    input: 'text',
  },
];

const COACHING_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Student Name',
    category: 'primary',
    description: 'Student full name',
    input: 'text',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'Parent or student WhatsApp number',
    input: 'phone',
  },
  {
    key: 'service',
    label: 'Course / Programme',
    category: 'details',
    description: 'Course or batch the enquiry is for',
    input: 'text',
  },
  {
    key: 'doctor_id',
    label: 'Counsellor',
    category: 'details',
    description: 'Assigned counsellor or teacher',
    input: 'provider',
  },
  {
    key: 'appointment_date',
    label: 'Session Date',
    category: 'schedule',
    description: 'Counselling or class date',
    input: 'date',
  },
  {
    key: 'appointment_time',
    label: 'Session Time',
    category: 'schedule',
    description: 'Counselling or class time',
    input: 'time',
  },
  {
    key: 'notes',
    label: 'Notes',
    category: 'details',
    description: 'Exam target, batch preference, or staff notes',
    input: 'text',
  },
];

const REAL_ESTATE_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Lead Name',
    category: 'primary',
    description: 'Visitor full name',
    input: 'text',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'WhatsApp / contact number',
    input: 'phone',
  },
  {
    key: 'property',
    label: 'Property',
    category: 'details',
    description: 'Listing or project to visit',
    input: 'text',
    placeholder: 'e.g. Lakeview Residences 2BHK',
  },
  {
    key: 'doctor_id',
    label: 'Agent',
    category: 'details',
    description: 'Assigned agent',
    input: 'provider',
  },
  {
    key: 'appointment_date',
    label: 'Visit Date',
    category: 'schedule',
    description: 'Site visit date',
    input: 'date',
  },
  {
    key: 'appointment_time',
    label: 'Visit Time',
    category: 'schedule',
    description: 'Site visit time',
    input: 'time',
  },
  {
    key: 'notes',
    label: 'Notes',
    category: 'details',
    description: 'Budget, requirements, or staff notes',
    input: 'text',
  },
];

const GENERAL_FIELDS: BookingFieldMeta[] = [
  {
    key: 'name',
    label: 'Contact Name',
    category: 'primary',
    description: 'Person this booking is for',
    input: 'text',
  },
  {
    key: 'phone',
    label: 'Mobile Number',
    category: 'primary',
    description: 'WhatsApp / contact number',
    input: 'phone',
  },
  {
    key: 'email',
    label: 'Email',
    category: 'details',
    description: 'Optional email',
    input: 'text',
  },
  {
    key: 'appointment_date',
    label: 'Date',
    category: 'schedule',
    description: 'Booking date',
    input: 'date',
  },
  {
    key: 'appointment_time',
    label: 'Time',
    category: 'schedule',
    description: 'Booking time',
    input: 'time',
  },
  {
    key: 'notes',
    label: 'Notes',
    category: 'details',
    description: 'Details for this booking',
    input: 'text',
  },
];

const FIELDS_BY_INDUSTRY: Record<CanonicalIndustry, BookingFieldMeta[]> = {
  hospital_clinic: CLINIC_FIELDS,
  travel: TRAVEL_FIELDS,
  restaurant: RESTAURANT_FIELDS,
  salon: SALON_FIELDS,
  gym: GYM_FIELDS,
  coaching: COACHING_FIELDS,
  solo_teacher: COACHING_FIELDS,
  real_estate: REAL_ESTATE_FIELDS,
  general: GENERAL_FIELDS,
};

const DEFAULTS_BY_INDUSTRY: Record<CanonicalIndustry, BookingFormConfig> = {
  hospital_clinic: DEFAULT_BOOKING_FORM_CONFIG,
  travel: {
    name: REQUIRED,
    phone: REQUIRED,
    email: HIDDEN,
    package_id: VISIBLE,
    destination: VISIBLE,
    travel_date: REQUIRED,
    guests_count: REQUIRED,
    total_price: VISIBLE,
    notes: VISIBLE,
  },
  restaurant: {
    name: REQUIRED,
    phone: REQUIRED,
    guests_count: REQUIRED,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
  salon: {
    name: REQUIRED,
    phone: REQUIRED,
    service: VISIBLE,
    doctor_id: VISIBLE,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
  gym: {
    name: REQUIRED,
    phone: REQUIRED,
    service: VISIBLE,
    doctor_id: VISIBLE,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
  coaching: {
    name: REQUIRED,
    phone: REQUIRED,
    service: VISIBLE,
    doctor_id: VISIBLE,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
  solo_teacher: {
    name: REQUIRED,
    phone: REQUIRED,
    service: VISIBLE,
    doctor_id: VISIBLE,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
  real_estate: {
    name: REQUIRED,
    phone: REQUIRED,
    property: VISIBLE,
    doctor_id: VISIBLE,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
  general: {
    name: REQUIRED,
    phone: REQUIRED,
    email: HIDDEN,
    appointment_date: REQUIRED,
    appointment_time: REQUIRED,
    notes: VISIBLE,
  },
};

export function getBookingIndustry(
  industry?: string | null
): CanonicalIndustry {
  return resolveIndustryAlias(industry);
}

export function getBookingFieldsForIndustry(
  industry?: string | null
): BookingFieldMeta[] {
  return FIELDS_BY_INDUSTRY[getBookingIndustry(industry)];
}

export function getDefaultBookingFormConfig(
  industry?: string | null
): BookingFormConfig {
  return { ...DEFAULTS_BY_INDUSTRY[getBookingIndustry(industry)] };
}

export function isClinicBookingIndustry(industry?: string | null): boolean {
  return getBookingIndustry(industry) === 'hospital_clinic';
}

export function isTravelBookingIndustry(industry?: string | null): boolean {
  return getBookingIndustry(industry) === 'travel';
}

/** Clinic-only keys that must never render on a non-clinic workspace. */
export const CLINIC_ONLY_BOOKING_FIELDS = new Set([
  'age',
  'gender',
  'dob',
  'blood_group',
  'emergency_contact',
  'guardian_name',
  'guardian_mobile',
  'doctor_id',
  'department',
  'appointment_type',
  'reason_for_visit',
  'insurance_provider',
  'insurance_number',
  'referred_by',
]);

export function mergeBookingFormConfig(
  industry: string | null | undefined,
  saved?: BookingFormConfig | null
): BookingFormConfig {
  const defaults = getDefaultBookingFormConfig(industry);
  const allowed = new Set(
    getBookingFieldsForIndustry(industry).map((field) => field.key)
  );
  const merged: BookingFormConfig = { ...defaults };
  if (saved) {
    for (const [key, value] of Object.entries(saved)) {
      if (!allowed.has(key)) continue;
      if (
        isTravelBookingIndustry(industry) &&
        CLINIC_ONLY_BOOKING_FIELDS.has(key)
      ) {
        continue;
      }
      merged[key] = value;
    }
  }
  merged.name = REQUIRED;
  merged.phone = REQUIRED;
  return merged;
}

export function fieldIsVisible(
  config: BookingFormConfig,
  key: string,
  fallback = true
): boolean {
  return config[key]?.show ?? fallback;
}

export function fieldIsRequired(
  config: BookingFormConfig,
  key: string,
  fallback = false
): boolean {
  return Boolean(config[key]?.show && (config[key]?.required ?? fallback));
}
