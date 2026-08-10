-- Migration 048: Add configurable appointment booking form settings to accounts table

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS appointment_form_config JSONB DEFAULT '{
  "name": { "show": true, "required": true },
  "phone": { "show": true, "required": true },
  "age": { "show": true, "required": false },
  "gender": { "show": true, "required": false },
  "dob": { "show": true, "required": false },
  "address": { "show": true, "required": false },
  "blood_group": { "show": true, "required": false },
  "emergency_contact": { "show": false, "required": false },
  "guardian_name": { "show": false, "required": false },
  "guardian_mobile": { "show": false, "required": false },
  "email": { "show": false, "required": false },
  "doctor_id": { "show": true, "required": false },
  "department": { "show": true, "required": false },
  "appointment_type": { "show": false, "required": false },
  "reason_for_visit": { "show": false, "required": false },
  "insurance_provider": { "show": false, "required": false },
  "insurance_number": { "show": false, "required": false },
  "referred_by": { "show": false, "required": false },
  "notes": { "show": true, "required": false }
}'::jsonb;
