-- ============================================================
-- 034_hospital_pipeline_stages.sql
--
-- Reconfigure all pipelines and stages to focus strictly on 
-- patient clinical pathways.
-- ============================================================

-- 1. Create a function to seed patient stages for all existing accounts
CREATE OR REPLACE FUNCTION seed_patient_pipelines()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account RECORD;
  v_pipeline_id UUID;
  v_owner_id UUID;
BEGIN
  FOR v_account IN SELECT id FROM accounts LOOP
    -- Find account owner profile
    SELECT user_id INTO v_owner_id 
    FROM profiles 
    WHERE account_id = v_account.id AND account_role = 'owner' 
    LIMIT 1;

    IF v_owner_id IS NULL THEN
      SELECT user_id INTO v_owner_id 
      FROM profiles 
      WHERE account_id = v_account.id 
      LIMIT 1;
    END IF;

    IF v_owner_id IS NOT NULL THEN
      -- Get or create Patient Care Pipeline
      SELECT id INTO v_pipeline_id 
      FROM pipelines 
      WHERE account_id = v_account.id 
      LIMIT 1;

      IF v_pipeline_id IS NULL THEN
        INSERT INTO pipelines (account_id, name, user_id)
        VALUES (v_account.id, 'Patient Care Pipeline', v_owner_id)
        RETURNING id INTO v_pipeline_id;
      ELSE
        UPDATE pipelines 
        SET name = 'Patient Care Pipeline' 
        WHERE id = v_pipeline_id;
      END IF;

      -- Clear old stages
      DELETE FROM pipeline_stages WHERE pipeline_id = v_pipeline_id;

      -- Insert patient care stages
      INSERT INTO pipeline_stages (pipeline_id, name, position, color) VALUES
        (v_pipeline_id, 'New Inquiry', 1, '#3b82f6'),            -- Blue
        (v_pipeline_id, 'Appointment Requested', 2, '#f59e0b'),  -- Orange
        (v_pipeline_id, 'Appointment Confirmed', 3, '#8b5cf6'),  -- Purple
        (v_pipeline_id, 'Visited', 4, '#6366f1'),                -- Indigo
        (v_pipeline_id, 'Treatment Ongoing', 5, '#ec4899'),      -- Pink
        (v_pipeline_id, 'Follow-up', 6, '#14b8a6'),              -- Teal
        (v_pipeline_id, 'Completed', 7, '#10b981');              -- Green
    END IF;
  END LOOP;
END;
$$;

-- 2. Execute the seeding
SELECT seed_patient_pipelines();

-- 3. Drop the function to clean up
DROP FUNCTION seed_patient_pipelines();
