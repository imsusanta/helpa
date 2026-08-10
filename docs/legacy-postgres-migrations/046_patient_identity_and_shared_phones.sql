-- Hospital patients may share a family phone number, but every patient must
-- retain a globally unique, stable Patient ID.

DROP INDEX IF EXISTS idx_contacts_account_phone_normalized;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_phone_normalized_non_patient
  ON contacts (account_id, phone_normalized)
  WHERE phone_normalized <> ''
    AND COALESCE(industry, '') NOT IN ('hospital', 'hospital_clinic');

CREATE SEQUENCE IF NOT EXISTS patient_seq_id_sequence START WITH 10001;

DO $$
DECLARE
  current_max BIGINT;
BEGIN
  SELECT COALESCE(
    MAX((substring(patient_seq_id FROM '([0-9]+)$'))::BIGINT),
    10000
  )
  INTO current_max
  FROM patients;

  PERFORM setval('patient_seq_id_sequence', current_max, true);
END;
$$;

CREATE OR REPLACE FUNCTION assign_patient_seq_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.patient_seq_id IS NULL OR btrim(NEW.patient_seq_id) = '' THEN
    NEW.patient_seq_id := 'PAT-' || lpad(nextval('patient_seq_id_sequence')::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_patient_seq_id ON patients;

CREATE TRIGGER set_patient_seq_id
  BEFORE INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION assign_patient_seq_id();
