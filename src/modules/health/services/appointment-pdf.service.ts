/**
 * Helpa Health Module — Appointment Slip Service
 *
 * Generates official Digital Appointment Slips with Clinic Header, Patient ID,
 * Doctor Details, Date/Time, Token Number, and Booking Source.
 */

export interface AppointmentSlipData {
  clinicName: string;
  clinicAddress?: string;
  clinicContact?: string;
  patientName: string;
  patientId: string;
  patientMobile: string;
  doctorName: string;
  department: string;
  consultationFee: number;
  appointmentDate: string;
  appointmentTime: string;
  tokenNumber: string;
  bookingSource: 'WhatsApp' | 'Reception' | 'Web';
  bookingCreatedAt: string;
  importantNotes?: string;
}

export function generateAppointmentSlipText(data: AppointmentSlipData): string {
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 ${data.clinicName.toUpperCase()}
📍 ${data.clinicAddress || 'Clinic Reception'} | 📞 ${data.clinicContact || 'WhatsApp Desk'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 DIGITAL APPOINTMENT CONFIRMATION SLIP

👤 PATIENT DETAILS:
• Name: ${data.patientName}
• Patient ID: ${data.patientId}
• Mobile: ${data.patientMobile}

👨‍⚕️ CONSULTATION DETAILS:
• Doctor: ${data.doctorName}
• Department: ${data.department}
• Date: ${data.appointmentDate}
• Time: ${data.appointmentTime}
• Token: 🎫 ${data.tokenNumber}
• Fee: ₹${data.consultationFee}

📌 BOOKING INFORMATION:
• Channel: ${data.bookingSource}
• Confirmed At: ${data.bookingCreatedAt}

⚠️ IMPORTANT INSTRUCTIONS:
1. Please arrive 15 minutes before your scheduled slot.
2. Show this digital token at the reception desk.
3. Bring previous prescriptions and medical reports if applicable.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
