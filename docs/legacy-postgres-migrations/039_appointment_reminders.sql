-- Create appointment reminder fields on accounts and appointments
ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_24h_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_2h_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_custom_time INTEGER DEFAULT NULL, -- Custom time offset in minutes
  ADD COLUMN IF NOT EXISTS reminder_template TEXT DEFAULT 'Hello {{PatientName}},\n\nThis is a reminder that you have an appointment {{ReminderTime}}.\n\n🏥 Hospital: {{HospitalName}}\n👨⚕️ Doctor: {{DoctorName}}\n🏥 Department: {{Department}}\n📅 Date: {{AppointmentDate}}\n🕒 Time: {{AppointmentTime}}\n🎫 Token Number: {{TokenNumber}}\n\nPlease arrive at least 15 minutes before your appointment.\n\nReply with:\n1️⃣ Confirm\n2️⃣ Reschedule\n3️⃣ Cancel\n\nNeed help? Just reply to this message.',
  ADD COLUMN IF NOT EXISTS reminder_business_hours JSONB DEFAULT '{"enabled": false, "start": "09:00", "end": "17:00"}';

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT false;
