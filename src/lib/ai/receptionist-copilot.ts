export type CopilotDataSource = "openrouter" | "rules";

export interface CopilotDoctor {
  id?: string | null;
  name?: string | null;
  department?: string | null;
  specialization?: string | null;
}

export interface CopilotContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
}

export interface CopilotPatient {
  patient_seq_id?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  department?: string | null;
  ai_summary?: string | null;
  ai_notes?: string | null;
  status?: string | null;
  assigned_doctor?: CopilotDoctor | CopilotDoctor[] | null;
}

export interface CopilotAppointment {
  id?: string;
  appointment_date: string;
  appointment_time?: string | null;
  status?: string | null;
  department?: string | null;
  token_number?: number | null;
  queue_position?: number | null;
  booking_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
  doctor?: CopilotDoctor | CopilotDoctor[] | null;
}

export interface CopilotReport {
  id?: string;
  test_name?: string | null;
  status?: string | null;
  expected_delivery_date?: string | null;
  report_pdf_url?: string | null;
  result_url?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CopilotInsuranceProvider {
  provider_name?: string | null;
  cashless_available?: boolean | null;
  required_documents?: string[] | null;
}

export interface CopilotKbEntry {
  category?: string | null;
  question_title?: string | null;
  answer_content?: string | null;
}

export interface CopilotMessage {
  sender_type?: string | null;
  content_type?: string | null;
  content_text?: string | null;
  created_at?: string | null;
}

export interface CopilotConversationMemory {
  id?: string;
  status?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  ai_summary?: string | null;
  created_at?: string | null;
}

export interface CopilotContactNote {
  note_text?: string | null;
  created_at?: string | null;
}

export interface CopilotSourceContext {
  accountName?: string | null;
  contact: CopilotContact;
  patient?: CopilotPatient | null;
  messages: CopilotMessage[];
  conversationMemory?: CopilotConversationMemory[];
  appointments?: CopilotAppointment[];
  reports?: CopilotReport[];
  insuranceProviders?: CopilotInsuranceProvider[];
  kbEntries?: CopilotKbEntry[];
  contactNotes?: CopilotContactNote[];
}

export interface CopilotPatientInfo {
  patientName: string;
  patientId: string;
  phoneNumber: string;
  age: string;
  gender: string;
  preferredLanguage: string;
  preferredDoctor: string;
  preferredDepartment: string;
}

export interface CopilotVisitInfo {
  exists: boolean;
  date: string;
  doctor: string;
  department: string;
  status: string;
  emptyMessage?: string;
}

export interface CopilotAppointmentInfo {
  exists: boolean;
  date: string;
  time: string;
  doctor: string;
  department: string;
  status: string;
  tokenNumber: string;
  queuePosition: string;
  emptyMessage?: string;
}

export interface CopilotReportInfo {
  exists: boolean;
  name: string;
  status: string;
  date: string;
  ready: boolean;
  emptyMessage?: string;
}

export interface CopilotInsuranceInfo {
  exists: boolean;
  provider: string;
  cashlessAvailable: string;
  status: string;
  coverageNotes: string;
  emptyMessage?: string;
}

export interface CopilotConfidence {
  label: string;
  score: number;
}

export interface CopilotTimelineItem {
  date: string;
  title: string;
  detail?: string;
}

export interface ReceptionistCopilotSnapshot {
  generatedAt: string;
  generatedBy: CopilotDataSource;
  warning?: string;
  patientSummary: string[];
  patientInfo: CopilotPatientInfo;
  lastVisit: CopilotVisitInfo;
  upcomingAppointment: CopilotAppointmentInfo;
  reportInfo: CopilotReportInfo;
  insuranceInfo: CopilotInsuranceInfo;
  conversationSummary: string;
  suggestedReply: string;
  suggestedActions: string[];
  internalNotes: string[];
  intent: CopilotConfidence;
  confidence: CopilotConfidence[];
  timeline: CopilotTimelineItem[];
}

export interface OpenRouterCopilotArgs {
  apiKey: string;
  model: string;
  systemPrompt?: string | null;
  context: CopilotSourceContext;
  fallback: ReceptionistCopilotSnapshot;
}

const NOT_AVAILABLE = "Not available";
const NOT_REGISTERED = "Not registered";
const UNKNOWN = "Unknown";

const MEDICAL_ADVICE_KEYWORDS = [
  "diagnose",
  "diagnosis",
  "medicine",
  "medication",
  "tablet",
  "dosage",
  "dose",
  "prescribe",
  "prescription",
  "treatment",
  "interpret",
  "what does my report mean",
  "report mean",
  "normal range",
];

const EMERGENCY_KEYWORDS = [
  "emergency",
  "urgent",
  "chest pain",
  "breathing difficulty",
  "can't breathe",
  "cannot breathe",
  "severe bleeding",
  "unconscious",
  "stroke",
  "heart attack",
  "accident",
];

function compact<T>(items: Array<T | null | undefined | false | "">): T[] {
  return items.filter(Boolean) as T[];
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function valueOr(value: unknown, fallback = NOT_AVAILABLE): string {
  const text = normalizeText(value);
  return text.length > 0 ? text : fallback;
}

function clampText(value: unknown, fallback: string, maxLength = 180): string {
  const text = valueOr(value, fallback);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(
  value: unknown,
  fallback: string[],
  maxItems: number,
  maxLength = 180,
): string[] {
  const arr = asArray(value)
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) =>
      item.length > maxLength ? `${item.slice(0, maxLength - 1)}...` : item,
    );
  return arr.length > 0 ? arr : fallback.slice(0, maxItems);
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined): string {
  const date = safeDate(value);
  if (!date) return NOT_AVAILABLE;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  const [hours, minutes] = value.split(":");
  if (!hours || !minutes) return value;
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayKey(value: string | null | undefined): number {
  const date = safeDate(value);
  if (!date) return 0;
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function todayKey(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function doctorFrom(
  doctor: CopilotDoctor | CopilotDoctor[] | null | undefined,
): CopilotDoctor | null {
  if (Array.isArray(doctor)) return doctor[0] ?? null;
  return doctor ?? null;
}

function doctorName(doctor: CopilotDoctor | CopilotDoctor[] | null | undefined) {
  return valueOr(doctorFrom(doctor)?.name, "Unassigned");
}

function doctorDepartment(
  doctor: CopilotDoctor | CopilotDoctor[] | null | undefined,
) {
  return valueOr(doctorFrom(doctor)?.department, NOT_AVAILABLE);
}

function calculateAge(dateOfBirth: string | null | undefined): string {
  const dob = safeDate(dateOfBirth);
  if (!dob) return NOT_AVAILABLE;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? String(age) : NOT_AVAILABLE;
}

function messageText(messages: CopilotMessage[]): string {
  return messages
    .map((message) => message.content_text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function latestCustomerMessage(messages: CopilotMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.sender_type === "customer" && message.content_text) {
      return message.content_text;
    }
  }
  return "";
}

function inferLanguage(text: string): string {
  if (/[\u0980-\u09ff]/.test(text)) return "Bengali";
  if (/[\u0900-\u097f]/.test(text)) return "Hindi";
  if (/[\u0600-\u06ff]/.test(text)) return "Arabic";
  if (/[¿¡ñáéíóúü]/i.test(text)) return "Spanish";
  return "English";
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

function inferIntent(text: string): CopilotConfidence[] {
  const lower = text.toLowerCase();
  if (containsAny(lower, EMERGENCY_KEYWORDS)) {
    return [
      { label: "Emergency Inquiry", score: 97 },
      { label: "Transfer to Doctor", score: 91 },
    ];
  }
  if (containsAny(lower, MEDICAL_ADVICE_KEYWORDS)) {
    return [
      { label: "Medical Advice Request", score: 94 },
      { label: "Transfer to Doctor", score: 90 },
    ];
  }
  if (
    containsAny(lower, [
      "reschedule",
      "change appointment",
      "change my appointment",
      "move appointment",
    ])
  ) {
    return [
      { label: "Reschedule Appointment", score: 92 },
      { label: "Appointment Booking", score: 76 },
    ];
  }
  if (
    containsAny(lower, [
      "cancel appointment",
      "cancel my appointment",
      "cancel booking",
    ])
  ) {
    return [
      { label: "Cancel Appointment", score: 91 },
      { label: "Appointment Booking", score: 68 },
    ];
  }
  if (
    containsAny(lower, [
      "appointment",
      "book",
      "booking",
      "consult",
      "consultation",
      "slot",
      "tomorrow",
      "today",
      "follow up",
      "follow-up",
    ])
  ) {
    return [
      { label: "Appointment Booking", score: 90 },
      { label: "Follow-up Consultation", score: lower.includes("follow") ? 86 : 65 },
    ];
  }
  if (
    containsAny(lower, [
      "report",
      "result",
      "lab",
      "blood test",
      "cbc",
      "x-ray",
      "scan",
    ])
  ) {
    return [
      { label: "Report Inquiry", score: 90 },
      { label: "Send Report", score: 75 },
    ];
  }
  if (
    containsAny(lower, [
      "insurance",
      "cashless",
      "coverage",
      "claim",
      "policy",
      "provider",
    ])
  ) {
    return [
      { label: "Insurance Inquiry", score: 89 },
      { label: "Collect Insurance Details", score: 77 },
    ];
  }
  if (
    containsAny(lower, [
      "doctor",
      "dr ",
      "dr.",
      "department",
      "available",
      "availability",
      "fee",
      "cost",
    ])
  ) {
    return [
      { label: lower.includes("fee") || lower.includes("cost") ? "Consultation Fee" : "Doctor Availability", score: 84 },
      { label: "Appointment Booking", score: 66 },
    ];
  }
  return [{ label: "General Question", score: 72 }];
}

function getLatestReport(reports: CopilotReport[]): CopilotReport | null {
  return [...reports].sort((a, b) => {
    const aDate = safeDate(a.created_at ?? a.updated_at)?.getTime() ?? 0;
    const bDate = safeDate(b.created_at ?? b.updated_at)?.getTime() ?? 0;
    return bDate - aDate;
  })[0] ?? null;
}

function getUpcomingAppointment(
  appointments: CopilotAppointment[],
): CopilotAppointment | null {
  const today = todayKey();
  return (
    [...appointments]
      .filter((appt) => {
        const status = (appt.status ?? "").toLowerCase();
        return (
          dayKey(appt.appointment_date) >= today &&
          !["cancelled", "completed", "no_show"].includes(status)
        );
      })
      .sort((a, b) => {
        const byDay = dayKey(a.appointment_date) - dayKey(b.appointment_date);
        if (byDay !== 0) return byDay;
        return (a.appointment_time ?? "").localeCompare(b.appointment_time ?? "");
      })[0] ?? null
  );
}

function getLastVisit(appointments: CopilotAppointment[]): CopilotAppointment | null {
  const today = todayKey();
  return (
    [...appointments]
      .filter((appt) => {
        const status = (appt.status ?? "").toLowerCase();
        return (
          dayKey(appt.appointment_date) < today ||
          ["completed", "cancelled", "no_show"].includes(status)
        );
      })
      .sort((a, b) => dayKey(b.appointment_date) - dayKey(a.appointment_date))[0] ??
    null
  );
}

function mentionedProvider(
  sourceText: string,
  providers: CopilotInsuranceProvider[],
): CopilotInsuranceProvider | null {
  const lower = sourceText.toLowerCase();
  return (
    providers.find((provider) => {
      const name = provider.provider_name?.toLowerCase().trim();
      return !!name && lower.includes(name);
    }) ?? null
  );
}

function preferredDoctor(
  patient: CopilotPatient | null | undefined,
  appointments: CopilotAppointment[],
): string {
  const assigned = doctorName(patient?.assigned_doctor);
  if (assigned !== "Unassigned") return assigned;
  const withDoctor = appointments.find((appt) => doctorName(appt.doctor) !== "Unassigned");
  return withDoctor ? doctorName(withDoctor.doctor) : NOT_AVAILABLE;
}

function preferredDepartment(
  patient: CopilotPatient | null | undefined,
  appointments: CopilotAppointment[],
): string {
  if (patient?.department) return patient.department;
  const assigned = doctorDepartment(patient?.assigned_doctor);
  if (assigned !== NOT_AVAILABLE) return assigned;
  const withDept = appointments.find((appt) => appt.department || doctorDepartment(appt.doctor) !== NOT_AVAILABLE);
  return withDept ? valueOr(withDept.department, doctorDepartment(withDept.doctor)) : NOT_AVAILABLE;
}

function buildConversationSummary(
  intent: string,
  latestText: string,
  upcoming: CopilotAppointment | null,
  latestReport: CopilotReport | null,
  insurance: CopilotInsuranceInfo,
): string {
  const parts = compact<string>([
    intent === "General Question"
      ? latestText
        ? `The patient is asking: "${latestText.slice(0, 120)}${latestText.length > 120 ? "..." : ""}".`
        : "The conversation is active but has limited recent text."
      : `The patient appears to need help with ${intent.toLowerCase()}.`,
    upcoming
      ? `There is an upcoming appointment on ${formatDate(upcoming.appointment_date)} at ${formatTime(upcoming.appointment_time)}.`
      : "No upcoming appointment is currently visible.",
    latestReport
      ? `Latest report is ${valueOr(latestReport.test_name)} with status ${titleCase(valueOr(latestReport.status, UNKNOWN))}.`
      : "No lab report is currently visible.",
    insurance.exists ? `Insurance context: ${insurance.status}.` : "",
  ]);
  return parts.slice(0, 4).join(" ");
}

function buildSuggestedActions(
  primaryIntent: string,
  upcoming: CopilotAppointment | null,
  latestReport: CopilotReport | null,
  insurance: CopilotInsuranceInfo,
): string[] {
  const readyReport = latestReport?.status?.toLowerCase() === "ready";
  const actions = compact<string>([
    primaryIntent === "Emergency Inquiry" ? "Call Patient" : "",
    primaryIntent === "Emergency Inquiry" ? "Transfer to Doctor" : "",
    primaryIntent === "Medical Advice Request" ? "Transfer to Doctor" : "",
    primaryIntent.includes("Reschedule") ? "Reschedule Appointment" : "",
    primaryIntent.includes("Cancel") ? "Cancel Appointment" : "",
    primaryIntent.includes("Appointment") && !upcoming ? "Book Appointment" : "",
    upcoming ? "Confirm Appointment" : "",
    upcoming ? "Resend Appointment Slip" : "",
    primaryIntent === "Report Inquiry" && readyReport ? "Send Report" : "",
    primaryIntent === "Report Inquiry" && !readyReport ? "Check Report Status" : "",
    primaryIntent === "Insurance Inquiry" || insurance.exists
      ? "Collect Insurance Details"
      : "",
    "Open Patient Profile",
  ]);
  return Array.from(new Set(actions)).slice(0, 7);
}

function buildSuggestedReply(
  patientName: string,
  primaryIntent: string,
  upcoming: CopilotAppointment | null,
  latestReport: CopilotReport | null,
): string {
  const greetingName = patientName === UNKNOWN ? "" : ` ${patientName}`;
  if (primaryIntent === "Emergency Inquiry") {
    return `Hello${greetingName}, this may need urgent medical attention. Please call emergency services or visit the nearest emergency department immediately. I will also alert our clinical team so a doctor or staff member can take over.`;
  }
  if (primaryIntent === "Medical Advice Request") {
    return `Hello${greetingName}, I can help with appointments, reports, and hospital coordination, but a doctor must advise on diagnosis, medicines, treatment, or report interpretation. Would you like me to connect you with the doctor or book a consultation?`;
  }
  if (primaryIntent.includes("Appointment") || primaryIntent.includes("Consultation")) {
    if (upcoming) {
      return `Hello${greetingName}, your appointment is scheduled for ${formatDate(upcoming.appointment_date)} at ${formatTime(upcoming.appointment_time)} with ${doctorName(upcoming.doctor)} in ${valueOr(upcoming.department, doctorDepartment(upcoming.doctor))}. Token number: ${upcoming.token_number ?? "not assigned yet"}. Please confirm if you would like to keep this slot or make a change.`;
    }
    return `Hello${greetingName}, I can help book your consultation. Please share your preferred date, time, doctor or department, and patient name so we can check the available slots.`;
  }
  if (primaryIntent === "Report Inquiry") {
    if (latestReport?.status?.toLowerCase() === "ready") {
      return `Hello${greetingName}, your ${valueOr(latestReport.test_name, "latest")} report is marked ready. I can verify your details and share the report through the approved hospital process.`;
    }
    if (latestReport) {
      return `Hello${greetingName}, your ${valueOr(latestReport.test_name, "latest")} report is currently ${titleCase(valueOr(latestReport.status, "in progress"))}. We will update you as soon as it is ready.`;
    }
    return `Hello${greetingName}, I do not see a report linked here yet. Please share the test name or report booking details so I can check the status.`;
  }
  if (primaryIntent === "Insurance Inquiry") {
    return `Hello${greetingName}, please share your insurance provider, policy or card details, and any required documents. We can check cashless availability, but final approval depends on your insurer and policy terms.`;
  }
  return `Hello${greetingName}, thanks for your message. I will check the patient details and help you with the next step. Could you please confirm the appointment, report, or billing detail you need help with?`;
}

function buildInternalNotes(
  context: CopilotSourceContext,
  language: string,
  doctor: string,
  department: string,
): string[] {
  const allText = messageText(context.messages).toLowerCase();
  const patientNotes = context.patient?.ai_notes
    ? context.patient.ai_notes
        .split(/\n+/)
        .map((note) => note.trim())
        .filter(Boolean)
    : [];

  return compact<string>([
    ...patientNotes.slice(0, 3),
    language !== "English" ? `Prefers ${language} support.` : "",
    doctor !== NOT_AVAILABLE ? `Usually consults ${doctor}.` : "",
    department !== NOT_AVAILABLE ? `Frequently visits ${department}.` : "",
    allText.includes("evening") ? "Patient prefers evening appointments." : "",
    allText.includes("wheelchair") ? "Requires wheelchair assistance." : "",
    allText.includes("bengali") ? "Frequently asks for Bengali support." : "",
    allText.includes("annual health") || allText.includes("health package")
      ? "Interested in annual health package."
      : "",
  ]).slice(0, 6);
}

function buildTimeline(context: CopilotSourceContext): CopilotTimelineItem[] {
  const appointmentItems =
    context.appointments?.map((appt) => ({
      date: formatDate(appt.appointment_date),
      title:
        (appt.status?.toLowerCase() === "completed"
          ? "Visited"
          : "Appointment") + ` ${doctorName(appt.doctor)}`,
      detail: compact([
        valueOr(appt.department, doctorDepartment(appt.doctor)),
        appt.status ? titleCase(appt.status) : "",
        appt.token_number ? `Token #${appt.token_number}` : "",
      ]).join(" - "),
      rawDate: dayKey(appt.appointment_date),
    })) ?? [];

  const reportItems =
    context.reports?.map((report) => ({
      date: formatDate(report.created_at ?? report.updated_at),
      title: `${valueOr(report.test_name, "Report")} ${report.status?.toLowerCase() === "ready" ? "Ready" : "Updated"}`,
      detail: report.status ? titleCase(report.status) : undefined,
      rawDate: safeDate(report.created_at ?? report.updated_at)?.getTime() ?? 0,
    })) ?? [];

  const noteItems =
    context.contactNotes?.map((note) => ({
      date: formatDate(note.created_at),
      title: "Staff note added",
      detail: clampText(note.note_text, "", 90),
      rawDate: safeDate(note.created_at)?.getTime() ?? 0,
    })) ?? [];

  const conversationItems =
    context.conversationMemory?.map((memory) => ({
      date: formatDate(memory.last_message_at ?? memory.created_at),
      title: "Conversation activity",
      detail: clampText(memory.ai_summary || memory.last_message_text, "", 90),
      rawDate: safeDate(memory.last_message_at ?? memory.created_at)?.getTime() ?? 0,
    })) ?? [];

  return [...appointmentItems, ...reportItems, ...noteItems, ...conversationItems]
    .filter((item) => item.date !== NOT_AVAILABLE)
    .sort((a, b) => a.rawDate - b.rawDate)
    .slice(-8)
    .map((item) => ({
      date: item.date,
      title: item.title,
      detail: item.detail,
    }));
}

export function buildFallbackCopilotSnapshot(
  context: CopilotSourceContext,
  warning?: string,
): ReceptionistCopilotSnapshot {
  const appointments = context.appointments ?? [];
  const reports = context.reports ?? [];
  const providers = context.insuranceProviders ?? [];
  const allText = messageText(context.messages);
  const latestText = latestCustomerMessage(context.messages);
  const language = inferLanguage(latestText || allText);
  const confidence = inferIntent(allText);
  const intent = confidence[0] ?? { label: "General Question", score: 72 };
  const upcoming = getUpcomingAppointment(appointments);
  const lastVisit = getLastVisit(appointments);
  const latestReport = getLatestReport(reports);
  const provider = mentionedProvider(allText, providers);
  const preferredDoc = preferredDoctor(context.patient, appointments);
  const preferredDept = preferredDepartment(context.patient, appointments);
  const patientName = valueOr(context.contact.name, UNKNOWN);

  const insuranceInfo: CopilotInsuranceInfo = provider
    ? {
        exists: true,
        provider: valueOr(provider.provider_name),
        cashlessAvailable: provider.cashless_available ? "Yes" : "No",
        status: provider.cashless_available
          ? "Provider supports cashless workflow"
          : "Provider listed, cashless not available",
        coverageNotes:
          provider.required_documents && provider.required_documents.length > 0
            ? `Required documents: ${provider.required_documents.join(", ")}`
            : "Verify policy details before confirming coverage.",
      }
    : {
        exists: false,
        provider: NOT_AVAILABLE,
        cashlessAvailable: UNKNOWN,
        status: "No insurance information found.",
        coverageNotes: "Collect insurance provider, policy number, and ID card before checking coverage.",
        emptyMessage: "No insurance information found.",
      };

  const patientInfo: CopilotPatientInfo = {
    patientName,
    patientId: valueOr(context.patient?.patient_seq_id, NOT_REGISTERED),
    phoneNumber: valueOr(context.contact.phone),
    age: calculateAge(context.patient?.date_of_birth),
    gender: valueOr(context.patient?.gender),
    preferredLanguage: language,
    preferredDoctor: preferredDoc,
    preferredDepartment: preferredDept,
  };

  const lastVisitInfo: CopilotVisitInfo = lastVisit
    ? {
        exists: true,
        date: formatDate(lastVisit.appointment_date),
        doctor: doctorName(lastVisit.doctor),
        department: valueOr(lastVisit.department, doctorDepartment(lastVisit.doctor)),
        status: titleCase(valueOr(lastVisit.status, UNKNOWN)),
      }
    : {
        exists: false,
        date: NOT_AVAILABLE,
        doctor: NOT_AVAILABLE,
        department: NOT_AVAILABLE,
        status: NOT_AVAILABLE,
        emptyMessage: "No previous visit recorded.",
      };

  const upcomingInfo: CopilotAppointmentInfo = upcoming
    ? {
        exists: true,
        date: formatDate(upcoming.appointment_date),
        time: formatTime(upcoming.appointment_time),
        doctor: doctorName(upcoming.doctor),
        department: valueOr(upcoming.department, doctorDepartment(upcoming.doctor)),
        status: titleCase(valueOr(upcoming.status, UNKNOWN)),
        tokenNumber: upcoming.token_number ? `#${upcoming.token_number}` : NOT_AVAILABLE,
        queuePosition: upcoming.queue_position ? String(upcoming.queue_position) : NOT_AVAILABLE,
      }
    : {
        exists: false,
        date: NOT_AVAILABLE,
        time: NOT_AVAILABLE,
        doctor: NOT_AVAILABLE,
        department: NOT_AVAILABLE,
        status: NOT_AVAILABLE,
        tokenNumber: NOT_AVAILABLE,
        queuePosition: NOT_AVAILABLE,
        emptyMessage: "No upcoming appointment found.",
      };

  const reportInfo: CopilotReportInfo = latestReport
    ? {
        exists: true,
        name: valueOr(latestReport.test_name, "Latest report"),
        status:
          latestReport.status?.toLowerCase() === "ready"
            ? "Report Ready"
            : titleCase(valueOr(latestReport.status, UNKNOWN)),
        date: formatDate(latestReport.created_at ?? latestReport.updated_at),
        ready: latestReport.status?.toLowerCase() === "ready",
      }
    : {
        exists: false,
        name: NOT_AVAILABLE,
        status: "No reports available.",
        date: NOT_AVAILABLE,
        ready: false,
        emptyMessage: "No reports available.",
      };

  const patientSummary = compact<string>([
    appointments.length > 0 || context.patient ? "Returning patient" : "New patient",
    lastVisit ? `Last visit: ${formatDate(lastVisit.appointment_date)} with ${doctorName(lastVisit.doctor)}` : "",
    intent.label !== "General Question" ? `Current need: ${intent.label}` : "",
    latestReport ? `${valueOr(latestReport.test_name, "Latest report")}: ${reportInfo.status}` : "",
    upcoming
      ? `Waiting for ${formatDate(upcoming.appointment_date)} appointment`
      : "No upcoming appointment on file",
    insuranceInfo.exists ? `Insurance mentioned: ${insuranceInfo.provider}` : "",
  ]).slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    generatedBy: "rules",
    warning,
    patientSummary,
    patientInfo,
    lastVisit: lastVisitInfo,
    upcomingAppointment: upcomingInfo,
    reportInfo,
    insuranceInfo,
    conversationSummary: buildConversationSummary(
      intent.label,
      latestText,
      upcoming,
      latestReport,
      insuranceInfo,
    ),
    suggestedReply: buildSuggestedReply(
      patientName,
      intent.label,
      upcoming,
      latestReport,
    ),
    suggestedActions: buildSuggestedActions(
      intent.label,
      upcoming,
      latestReport,
      insuranceInfo,
    ),
    internalNotes: buildInternalNotes(context, language, preferredDoc, preferredDept),
    intent,
    confidence,
    timeline: buildTimeline(context),
  };
}

function snapshotFromUnknown(
  value: unknown,
  fallback: ReceptionistCopilotSnapshot,
): ReceptionistCopilotSnapshot {
  const obj = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const patientInfo = typeof obj.patientInfo === "object" && obj.patientInfo !== null
    ? (obj.patientInfo as Record<string, unknown>)
    : {};
  const lastVisit = typeof obj.lastVisit === "object" && obj.lastVisit !== null
    ? (obj.lastVisit as Record<string, unknown>)
    : {};
  const upcomingAppointment =
    typeof obj.upcomingAppointment === "object" && obj.upcomingAppointment !== null
      ? (obj.upcomingAppointment as Record<string, unknown>)
      : {};
  const reportInfo = typeof obj.reportInfo === "object" && obj.reportInfo !== null
    ? (obj.reportInfo as Record<string, unknown>)
    : {};
  const insuranceInfo =
    typeof obj.insuranceInfo === "object" && obj.insuranceInfo !== null
      ? (obj.insuranceInfo as Record<string, unknown>)
      : {};
  const intent = typeof obj.intent === "object" && obj.intent !== null
    ? (obj.intent as Record<string, unknown>)
    : {};

  const confidence = asArray(obj.confidence)
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const label = normalizeText(row.label);
      const score = Number(row.score);
      if (!label || Number.isNaN(score)) return null;
      return { label, score: Math.max(0, Math.min(100, Math.round(score))) };
    })
    .filter(Boolean) as CopilotConfidence[];

  const timeline = asArray(obj.timeline)
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const date = normalizeText(row.date);
      const title = normalizeText(row.title);
      if (!date || !title) return null;
      return {
        date: clampText(date, NOT_AVAILABLE, 32),
        title: clampText(title, "", 90),
        detail: normalizeText(row.detail)
          ? clampText(row.detail, "", 140)
          : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 8) as CopilotTimelineItem[];

  return {
    ...fallback,
    generatedAt: new Date().toISOString(),
    generatedBy: "openrouter",
    warning: undefined,
    patientSummary: asStringArray(obj.patientSummary, fallback.patientSummary, 6, 120),
    patientInfo: {
      patientName: clampText(patientInfo.patientName, fallback.patientInfo.patientName),
      patientId: clampText(patientInfo.patientId, fallback.patientInfo.patientId),
      phoneNumber: clampText(patientInfo.phoneNumber, fallback.patientInfo.phoneNumber),
      age: clampText(patientInfo.age, fallback.patientInfo.age, 32),
      gender: clampText(patientInfo.gender, fallback.patientInfo.gender, 32),
      preferredLanguage: clampText(
        patientInfo.preferredLanguage,
        fallback.patientInfo.preferredLanguage,
        60,
      ),
      preferredDoctor: clampText(
        patientInfo.preferredDoctor,
        fallback.patientInfo.preferredDoctor,
      ),
      preferredDepartment: clampText(
        patientInfo.preferredDepartment,
        fallback.patientInfo.preferredDepartment,
      ),
    },
    lastVisit: {
      exists:
        typeof lastVisit.exists === "boolean"
          ? lastVisit.exists
          : fallback.lastVisit.exists,
      date: clampText(lastVisit.date, fallback.lastVisit.date),
      doctor: clampText(lastVisit.doctor, fallback.lastVisit.doctor),
      department: clampText(lastVisit.department, fallback.lastVisit.department),
      status: clampText(lastVisit.status, fallback.lastVisit.status),
      emptyMessage: normalizeText(lastVisit.emptyMessage) || fallback.lastVisit.emptyMessage,
    },
    upcomingAppointment: {
      exists:
        typeof upcomingAppointment.exists === "boolean"
          ? upcomingAppointment.exists
          : fallback.upcomingAppointment.exists,
      date: clampText(upcomingAppointment.date, fallback.upcomingAppointment.date),
      time: clampText(upcomingAppointment.time, fallback.upcomingAppointment.time),
      doctor: clampText(upcomingAppointment.doctor, fallback.upcomingAppointment.doctor),
      department: clampText(
        upcomingAppointment.department,
        fallback.upcomingAppointment.department,
      ),
      status: clampText(upcomingAppointment.status, fallback.upcomingAppointment.status),
      tokenNumber: clampText(
        upcomingAppointment.tokenNumber,
        fallback.upcomingAppointment.tokenNumber,
      ),
      queuePosition: clampText(
        upcomingAppointment.queuePosition,
        fallback.upcomingAppointment.queuePosition,
      ),
      emptyMessage:
        normalizeText(upcomingAppointment.emptyMessage) ||
        fallback.upcomingAppointment.emptyMessage,
    },
    reportInfo: {
      exists:
        typeof reportInfo.exists === "boolean"
          ? reportInfo.exists
          : fallback.reportInfo.exists,
      name: clampText(reportInfo.name, fallback.reportInfo.name),
      status: clampText(reportInfo.status, fallback.reportInfo.status),
      date: clampText(reportInfo.date, fallback.reportInfo.date),
      ready:
        typeof reportInfo.ready === "boolean"
          ? reportInfo.ready
          : fallback.reportInfo.ready,
      emptyMessage: normalizeText(reportInfo.emptyMessage) || fallback.reportInfo.emptyMessage,
    },
    insuranceInfo: {
      exists:
        typeof insuranceInfo.exists === "boolean"
          ? insuranceInfo.exists
          : fallback.insuranceInfo.exists,
      provider: clampText(insuranceInfo.provider, fallback.insuranceInfo.provider),
      cashlessAvailable: clampText(
        insuranceInfo.cashlessAvailable,
        fallback.insuranceInfo.cashlessAvailable,
      ),
      status: clampText(insuranceInfo.status, fallback.insuranceInfo.status),
      coverageNotes: clampText(
        insuranceInfo.coverageNotes,
        fallback.insuranceInfo.coverageNotes,
        240,
      ),
      emptyMessage:
        normalizeText(insuranceInfo.emptyMessage) || fallback.insuranceInfo.emptyMessage,
    },
    conversationSummary: clampText(
      obj.conversationSummary,
      fallback.conversationSummary,
      500,
    ),
    suggestedReply: clampText(obj.suggestedReply, fallback.suggestedReply, 1200),
    suggestedActions: asStringArray(
      obj.suggestedActions,
      fallback.suggestedActions,
      8,
      80,
    ),
    internalNotes: asStringArray(obj.internalNotes, fallback.internalNotes, 6, 120),
    intent: {
      label: clampText(intent.label, fallback.intent.label, 80),
      score: Math.max(
        0,
        Math.min(
          100,
          Math.round(Number(intent.score) || fallback.intent.score),
        ),
      ),
    },
    confidence: confidence.length > 0 ? confidence.slice(0, 4) : fallback.confidence,
    timeline: timeline.length > 0 ? timeline : fallback.timeline,
  };
}

export function parseCopilotSnapshotJson(
  raw: string,
  fallback: ReceptionistCopilotSnapshot,
): ReceptionistCopilotSnapshot {
  const cleaned = raw
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return snapshotFromUnknown(JSON.parse(cleaned), fallback);
}

export async function generateOpenRouterCopilotSnapshot({
  apiKey,
  model,
  systemPrompt,
  context,
  fallback,
}: OpenRouterCopilotArgs): Promise<ReceptionistCopilotSnapshot> {
  const latestText = latestCustomerMessage(context.messages);
  const sourceContext = {
    accountName: context.accountName,
    patient: context.patient,
    contact: context.contact,
    messages: context.messages.slice(-80),
    previousConversations: context.conversationMemory?.slice(0, 8),
    appointments: context.appointments?.slice(0, 12),
    reports: context.reports?.slice(0, 8),
    insuranceProviders: context.insuranceProviders?.slice(0, 20),
    staffNotes: context.contactNotes?.slice(0, 8),
    knowledgeBase: context.kbEntries?.slice(0, 20),
    fallback,
  };

  const routeSafety = `You are generating a private AI Receptionist Copilot snapshot for hospital staff inside an inbox.
This is not an auto-reply bot and you must not send anything to the patient.
The suggestedReply is only a draft for a human receptionist to review and insert.
Never diagnose diseases, recommend medicines, interpret medical reports, suggest treatment, or provide emergency triage. If medical advice is requested, recommend transfer to a doctor. If emergency symptoms appear, recommend urgent human/ER escalation.
Use only the provided data. If a field is missing, say it is not available instead of inventing details.
Keep patientSummary to 5 or 6 short bullets. Keep internalNotes private and operational.
Return only a raw JSON object that matches the same shape as sourceContext.fallback.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://wacrm.tech",
      "X-Title": "wacrm AI Receptionist Copilot",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [routeSafety, systemPrompt ? `Tenant AI policy:\n${systemPrompt}` : ""]
            .filter(Boolean)
            .join("\n\n"),
        },
        {
          role: "user",
          content: `Latest patient message: ${latestText || "(none)"}\n\nBuild the copilot snapshot from this context:\n${JSON.stringify(sourceContext)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenRouter returned an empty copilot response");
  }

  return parseCopilotSnapshotJson(content, fallback);
}
