-- ============================================================
-- 060_reset_patients_appointments.sql
--
-- Wipe all patient and appointment data for a fresh start.
-- Preserves: contacts, conversations, hospital_doctors, hospital_branches
-- Resets: sequences for patient_seq_id and appointment booking_id
-- ============================================================

-- 1. Delete in dependency order (child tables first)
DELETE FROM appointments_feedback;
DELETE FROM billing_invoices;
DELETE FROM lab_reports;
DELETE FROM appointments;
DELETE FROM patients;

-- 2. Reset sequences to start fresh
ALTER SEQUENCE IF EXISTS patient_seq_id_sequence RESTART WITH 10001;
ALTER SEQUENCE IF EXISTS appointment_seq RESTART WITH 10001;

-- 3. Verify tables are empty (for logging)
DO $$
BEGIN
  RAISE NOTICE 'Reset complete. appointments: %, patients: %, lab_reports: %, billing_invoices: %, appointments_feedback: %',
    (SELECT count(*) FROM appointments),
    (SELECT count(*) FROM patients),
    (SELECT count(*) FROM lab_reports),
    (SELECT count(*) FROM billing_invoices),
    (SELECT count(*) FROM appointments_feedback);
END;
$$;
