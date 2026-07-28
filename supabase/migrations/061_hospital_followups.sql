-- 061_hospital_followups.sql
-- Create hospital_followups table for tracking patient follow-up reviews and reminders

CREATE TABLE IF NOT EXISTS public.hospital_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    followup_type TEXT NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    last_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_hospital_followups_account ON public.hospital_followups(account_id);
CREATE INDEX IF NOT EXISTS idx_hospital_followups_patient ON public.hospital_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_followups_due_date ON public.hospital_followups(due_date);

ALTER TABLE public.hospital_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for account members" ON public.hospital_followups;
CREATE POLICY "Enable all operations for account members" ON public.hospital_followups
    FOR ALL
    USING (account_id IN (
        SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
    ));
