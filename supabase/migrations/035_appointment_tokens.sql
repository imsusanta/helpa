-- ============================================================
-- 035_appointment_tokens.sql
--
-- Adds token queues, booking IDs, and insurance tables.
-- ============================================================

-- 1. Create sequence for friendly booking IDs
CREATE SEQUENCE IF NOT EXISTS appointment_seq START WITH 10001;

-- 2. Add columns to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_id TEXT UNIQUE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS token_number INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS queue_position INTEGER;

-- 3. Trigger function to auto-assign booking ID, token, and queue position
CREATE OR REPLACE FUNCTION assign_appointment_token()
RETURNS TRIGGER AS $$
DECLARE
  v_next_token INTEGER;
  v_year TEXT;
BEGIN
  -- Generate Booking ID if not provided
  IF NEW.booking_id IS NULL THEN
    v_year := to_char(COALESCE(NEW.created_at, NOW()), 'YYYY');
    NEW.booking_id := 'APT-' || v_year || '-' || nextval('appointment_seq')::text;
  END IF;

  -- Calculate next token number for this doctor on this date
  IF NEW.token_number IS NULL THEN
    SELECT COALESCE(MAX(token_number), 0) + 1
    INTO v_next_token
    FROM appointments
    WHERE doctor_id = NEW.doctor_id
      AND appointment_date = NEW.appointment_date;
      
    NEW.token_number := v_next_token;
    NEW.queue_position := v_next_token;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on appointments
DROP TRIGGER IF EXISTS appointments_token_trigger ON appointments;
CREATE TRIGGER appointments_token_trigger
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION assign_appointment_token();

-- 4. Create Insurance Supported table
CREATE TABLE IF NOT EXISTS hospital_insurance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  cashless_available BOOLEAN NOT NULL DEFAULT true,
  required_documents TEXT[] NOT NULL DEFAULT ARRAY['National Health ID Card', 'Government ID', 'Insurance Policy PDF'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hospital_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insurance" ON hospital_insurance
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Admins can manage insurance" ON hospital_insurance
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 5. Seed insurance providers for existing accounts
DO $$
DECLARE
  v_account RECORD;
BEGIN
  FOR v_account IN SELECT id FROM accounts LOOP
    INSERT INTO hospital_insurance (account_id, provider_name, cashless_available)
    VALUES
      (v_account.id, 'Blue Shield Health', true),
      (v_account.id, 'Aetna Clinical Care', true),
      (v_account.id, 'Cigna Medicare Plus', true),
      (v_account.id, 'Bupa Medical Alliance', false)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
