-- ============================================================
-- 040_report_status_enhancements.sql
--
-- Adds department, doctor_id, internal_notes, and
-- notified_patient columns to hospital_lab_reports for the
-- AI Report Status Assistant feature.
-- ============================================================

-- 1. Add department column
ALTER TABLE hospital_lab_reports ADD COLUMN IF NOT EXISTS department TEXT;

-- 2. Add referring doctor reference
ALTER TABLE hospital_lab_reports ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES hospital_doctors(id) ON DELETE SET NULL;

-- 3. Add internal staff-only notes (separate from patient-visible notes)
ALTER TABLE hospital_lab_reports ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 4. Track whether the patient was WhatsApp-notified when report became ready
ALTER TABLE hospital_lab_reports ADD COLUMN IF NOT EXISTS notified_patient BOOLEAN NOT NULL DEFAULT false;
