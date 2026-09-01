BEGIN;

-- Compatibility columns required by the current WhatsApp contact/conversation
-- resolver. Existing rows are preserved; no destructive changes.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Keep the existing canonical created_by field and the compatibility user_id
-- field synchronized for rows created by either code path.
UPDATE public.contacts
SET user_id = created_by
WHERE user_id IS NULL
  AND created_by IS NOT NULL;

-- Only add the FK when it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass
      AND conname = 'contacts_user_id_fkey'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Canonical normalized phone key used by the dedupe/resolution code.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (
    CASE
      WHEN phone IS NULL OR btrim(phone) = '' THEN NULL
      ELSE regexp_replace(phone, '\\D', '', 'g')
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_account_phone_normalized
  ON public.contacts(account_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

-- Prevent duplicate WhatsApp contacts inside one workspace while allowing
-- the same phone number to exist in different workspaces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_account_phone_normalized
  ON public.contacts(account_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

-- Compatibility trigger: whichever ownership column an older/newer code path
-- writes, keep the other populated. It never overwrites a non-null value.
CREATE OR REPLACE FUNCTION public.sync_contact_owner_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.user_id := NEW.created_by;
  ELSIF NEW.created_by IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.created_by := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_contact_owner_columns ON public.contacts;
CREATE TRIGGER sync_contact_owner_columns
BEFORE INSERT OR UPDATE OF user_id, created_by ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_owner_columns();

COMMIT;
