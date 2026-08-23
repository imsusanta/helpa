'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/appwrite-compat';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { MessageTemplate } from '@/types';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';
import { parseContactCsv } from '@/lib/contacts/parse-contact-csv';
import {
  ArrowLeft,
  Sparkles,
  Send,
  FileText,
  Image as ImageIcon,
  Calendar,
  Users,
  Loader2,
  MessageSquare,
  Settings,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';

interface DoctorOption {
  id: string;
  name: string;
  department: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountId } = useAuth();
  const { terminology, currentIndustry } = useWorkspace();
  const audienceLabel = terminology.people;
  const { createAndSendBroadcast, isProcessing, progress } =
    useBroadcastSending();

  // Wizard Steps
  // Step 0: Category & Settings
  // Step 1: Target Audience Selection
  // Step 2: Content Composer & AI Writer
  // Step 3: Schedule & Review
  const [currentStep, setCurrentStep] = useState(0);

  // ═══════ STATE VARIABLES ═══════
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General Announcement');

  // Audience
  const [audienceType, setAudienceType] = useState<
    | 'all'
    | 'new_patients'
    | 'returning_patients'
    | 'upcoming_appointments'
    | 'missed_appointments'
    | 'due_followup'
    | 'by_department'
    | 'by_doctor'
    | 'by_gender'
    | 'by_age'
    | 'csv'
    | 'contact_list'
  >('all');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedGender, setSelectedGender] = useState('Male');
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(100);
  const [csvContacts, setCsvContacts] = useState<
    { phone: string; name?: string }[]
  >([]);
  const [csvFileName, setCsvFileName] = useState('');

  // Contact List States
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [manualContactName, setManualContactName] = useState('');
  const [manualContactPhone, setManualContactPhone] = useState('');
  const [tempContacts, setTempContacts] = useState<
    { name: string; phone: string }[]
  >([]);

  // Content Mode: 'custom' or 'template'
  const [contentMode, setContentMode] = useState<'custom' | 'template'>(
    'custom'
  );

  // Custom message states
  const [customMessage, setCustomMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'image' | 'document'>(
    'image'
  );
  const [ctaType, setCtaType] = useState<
    'none' | 'appointment' | 'review' | 'url'
  >('none');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  // AI Campaign Writer helper state
  const [aiPrompt, setAiPrompt] = useState('');
  const [writingMessage, setWritingMessage] = useState(false);

  // Template Mode states
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, { type: 'static' | 'field' | 'custom_field'; value: string }>
  >({});

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'scheduled'>(
    'immediate'
  );
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [recurrence, setRecurrence] = useState<
    'none' | 'weekly' | 'monthly' | 'yearly'
  >('none');

  // Load configuration lists
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ═══════ ON MOUNT ═══════
  useEffect(() => {
    if (!accountId) return;

    async function loadConfig() {
      try {
        // 1. Fetch active doctors via authenticated API
        const docRes = await fetch('/api/doctors?status=active', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (docRes.ok) {
          const docPayload = await docRes.json();
          setDoctors(docPayload.data || []);
        }

        // 2. Fetch approved Meta templates
        try {
          const tempRes = await fetch('/api/whatsapp/templates/sync', {
            credentials: 'include',
          });
          if (tempRes.ok) {
            const tempPayload = await tempRes.json();
            setTemplates(tempPayload.templates || []);
          }
        } catch {
          // Template fallback
        }

        // 3. Fetch contact tags
        const appwrite = createClient();
        const { data: tagRows } = await appwrite
          .from('tags')
          .select('id, name')
          .eq('account_id', accountId);
        setTags(tagRows || []);
      } catch (err) {
        console.error('Failed to load builder configurations:', err);
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();

    // Parse AI Suggestion redirect params
    const suggestionType = searchParams.get('suggestion');
    if (suggestionType === 'inactive') {
      setAudienceType('due_followup');
      setCategory('Annual Check-up Reminder');
      setName('Annual Health Check-up Broadcast');
      setAiPrompt(
        "Write a follow-up reminder inviting patients who haven't visited in 6 months for a comprehensive annual checkup at our clinic."
      );
    } else if (suggestionType === 'missed') {
      setAudienceType('missed_appointments');
      setCategory('Rescheduling Outreach');
      setName('Appointment Rescheduling Outreach');
      setAiPrompt(
        'Write an empathetic outreach message for patients who missed their recent appointment, asking if they would like to reschedule.'
      );
    } else if (suggestionType === 'wellness') {
      setAudienceType('all');
      setCategory('Seasonal Health Advisory');
      setName('Seasonal Wellness Broadcast');
      setAiPrompt(
        'Write a seasonal wellness update with helpful preventive health tips and advice for maintaining immunity this season.'
      );
    } else if (suggestionType === 'pediatric') {
      setAudienceType('by_department');
      setSelectedDept('Pediatrics');
      setCategory('Vaccination & Child Care');
      setName('Pediatric Health & Immunization Alert');
      setAiPrompt(
        'Write a friendly note to parents about upcoming pediatric vaccination drives and seasonal child wellness checks.'
      );
    }
  }, [accountId, searchParams]);

  // ═══════ AI COPYWRITER GENERATOR ═══════
  async function handleAiGenerateText() {
    if (!aiPrompt.trim()) {
      toast.error('Please specify what kind of message you want AI to draft.');
      return;
    }
    setWritingMessage(true);
    try {
      const res = await fetch('/api/campaigns/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          category,
          audienceType,
          department: selectedDept,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate copy');
      setCustomMessage(data.message);
      setContentMode('custom');
      toast.success('AI Campaign Message generated successfully!');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'AI writer failed');
    } finally {
      setWritingMessage(false);
    }
  }

  // ═══════ SAVE DRAFT ═══════
  async function handleSaveDraft() {
    if (!name.trim()) {
      toast.error('Give the campaign a name before saving a draft.');
      return;
    }
    try {
      const draftPayload = {
        name: name.trim(),
        message:
          contentMode === 'custom'
            ? customMessage
            : selectedTemplate?.name || 'Draft Campaign',
        target_type: audienceType,
        target_tag_id: selectedTagId || null,
        status: 'draft' as const,
        total_recipients: 0,
      };

      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save draft');
      }

      toast.success('Campaign draft saved successfully');
      router.push('/broadcasts');
    } catch (err: unknown) {
      toast.error(`Draft Save Error: ${(err as Error).message}`);
    }
  }

  // ═══════ EXECUTE / SCHEDULE SEND ═══════
  async function handleSendOrSchedule() {
    if (!name.trim()) {
      toast.error('Please enter a Campaign Name.');
      return;
    }
    if (contentMode === 'custom' && !customMessage.trim()) {
      toast.error('Please write a campaign message body.');
      return;
    }
    if (contentMode === 'template' && !selectedTemplate) {
      toast.error('Please select an approved Meta template.');
      return;
    }

    try {
      let finalAudienceType: string = audienceType;
      let finalTagIds: string[] | undefined = undefined;

      if (audienceType === 'contact_list') {
        const appwrite = createClient();
        let tagId = selectedTagId;

        // 1. Create a new tag if needed
        if (isCreatingNewTag && newTagName.trim()) {
          const { data: existingTag } = await appwrite
            .from('tags')
            .select('id')
            .eq('account_id', accountId)
            .eq('name', newTagName.trim())
            .maybeSingle();

          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const { data: newTag, error: tagErr } = await appwrite
              .from('tags')
              .insert({
                account_id: accountId,
                name: newTagName.trim(),
                color: '#4f46e5',
              })
              .select('id')
              .single();
            if (tagErr) throw tagErr;
            tagId = newTag.id;
          }
        }

        if (!tagId) {
          throw new Error('Please select or create a contact list (group).');
        }

        // 2. Insert and tag temporary contacts
        if (tempContacts.length > 0) {
          const {
            data: { session },
          } = await appwrite.auth.getSession();
          const user = session?.user;
          if (!user) throw new Error('Not authenticated');

          const uniqueContacts = new Map<
            string,
            { name: string; phone: string }
          >();
          for (const c of tempContacts) {
            const phoneClean = c.phone.trim().replace(/[^0-9+]/g, '');
            if (phoneClean) uniqueContacts.set(phoneClean, c);
          }

          const phones = [...uniqueContacts.keys()];

          // Look up existing
          const { data: existing } = await appwrite
            .from('contacts')
            .select('id, phone')
            .eq('account_id', accountId)
            .in('phone', phones);

          const existingByPhone = new Map<string, string>();
          for (const c of existing ?? []) {
            existingByPhone.set(c.phone, c.id);
          }

          const missing = phones
            .filter((p) => !existingByPhone.has(p))
            .map((phone) => ({
              account_id: accountId,
              user_id: user.id,
              phone,
              name: uniqueContacts.get(phone)?.name || null,
            }));

          const insertedIds: string[] = [];
          if (missing.length > 0) {
            const { data: newC, error: insertErr } = await appwrite
              .from('contacts')
              .insert(missing)
              .select('id');
            if (insertErr) throw insertErr;
            if (newC) insertedIds.push(...newC.map((c) => c.id));
          }

          const allContactIds = [...existingByPhone.values(), ...insertedIds];

          if (allContactIds.length > 0) {
            const tagLinks = allContactIds.map((cid) => ({
              contact_id: cid,
              tag_id: tagId,
            }));
            await appwrite
              .from('contact_tags')
              .upsert(tagLinks, { onConflict: 'contact_id,tag_id' });
          }
        }

        // Override audience type to 'tags' so hook executes natively
        finalAudienceType = 'tags';
        finalTagIds = [tagId];
      }

      // Mocking template structure for custom campaigns so useBroadcastSending executes natively
      let finalTemplate: MessageTemplate;
      let finalVariables: Record<string, unknown> = {};

      if (contentMode === 'custom') {
        // Construct a synthetic template row
        finalTemplate = {
          id: 'custom-text',
          name: name.replace(/\s+/g, '_').toLowerCase(),
          body_text: customMessage,
          category: 'Marketing',
          created_at: new Date().toISOString(),
        } as MessageTemplate;
      } else {
        finalTemplate = selectedTemplate!;
        finalVariables = templateVariables;
      }

      const _scheduledAt =
        scheduleMode === 'scheduled'
          ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
          : undefined;

      const broadcastId = await createAndSendBroadcast({
        name,
        template: finalTemplate,
        audience: {
          type: finalAudienceType,
          tagIds: finalTagIds,
          department: selectedDept || undefined,
          doctorId: selectedDoctorId || undefined,
          gender: selectedGender || undefined,
          ageMin: ageMin || undefined,
          ageMax: ageMax || undefined,
          csvContacts: audienceType === 'csv' ? csvContacts : undefined,
        },
        variables: finalVariables,
        category,
        message_body: contentMode === 'custom' ? customMessage : undefined,
        attachment_url: attachmentUrl || undefined,
        attachment_type: attachmentUrl ? attachmentType : undefined,
        cta_type: ctaType,
        cta_text: ctaText || undefined,
        cta_url: ctaUrl || undefined,
        recurrence,
        ai_suggested: !!searchParams.get('suggestion'),
      } as Parameters<typeof createAndSendBroadcast>[0]);

      toast.success(
        scheduleMode === 'scheduled'
          ? 'Campaign scheduled successfully!'
          : 'Campaign dispatched successfully!'
      );
      router.push(`/broadcasts/${broadcastId}`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Campaign execution failed.');
    }
  }

  const categoryOptions = [
    'Health Camp',
    'New Doctor Announcement',
    'Health Check-up Reminder',
    'Vaccination Campaign',
    'Follow-up Reminder',
    'Annual Check-up Reminder',
    'Festival Greetings',
    'Health Awareness',
    'Special Offer',
    'Review Request',
    'General Announcement',
  ];

  if (loadingConfig) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => router.push('/broadcasts')}
          variant="outline"
          size="icon"
          className="h-8 w-8 cursor-pointer rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            New Campaign Builder
          </h1>
          <p className="text-muted-foreground text-xs">
            Create structured patient notifications, segment your patient base,
            and schedule delivery.
          </p>
        </div>
      </div>

      {/* Stepper progress indicator */}
      <div className="text-muted-foreground border-border/50 grid grid-cols-4 gap-2 border-b pb-4 text-center text-xs font-semibold">
        <div
          className={`border-b-2 pb-2 transition ${currentStep === 0 ? 'border-indigo-600 text-indigo-600' : 'border-transparent'}`}
        >
          1. Settings
        </div>
        <div
          className={`border-b-2 pb-2 transition ${currentStep === 1 ? 'border-indigo-600 text-indigo-600' : 'border-transparent'}`}
        >
          2. Audience
        </div>
        <div
          className={`border-b-2 pb-2 transition ${currentStep === 2 ? 'border-indigo-600 text-indigo-600' : 'border-transparent'}`}
        >
          3. Composer
        </div>
        <div
          className={`border-b-2 pb-2 transition ${currentStep === 3 ? 'border-indigo-600 text-indigo-600' : 'border-transparent'}`}
        >
          4. Confirm
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.8fr_1.2fr]">
        {/* Left Side: Wizard Forms */}
        <div className="bg-card border-border space-y-5 rounded-2xl border p-5 text-left">
          {/* STEP 0: SETTINGS */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-foreground flex items-center gap-1.5 text-base font-bold">
                <Settings className="h-4 w-4" /> Campaign Settings
              </h2>

              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-bold uppercase">
                  Campaign Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology Free Health Camp July"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-bold uppercase">
                  Campaign Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setCurrentStep(1)}
                  disabled={!name.trim()}
                  className="rounded-full bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700"
                >
                  Next: Choose Audience
                </Button>
              </div>
            </div>
          )}

          {/* STEP 1: AUDIENCE SEGMENTATION */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-foreground flex items-center gap-1.5 text-base font-bold">
                <Users className="h-4 w-4" />
                Target {audienceLabel} Segment
              </h2>

              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-bold uppercase">
                  Target Audience Type
                </label>
                <select
                  value={audienceType}
                  onChange={(e) =>
                    setAudienceType(e.target.value as typeof audienceType)
                  }
                  className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  {currentIndustry === 'hospital_clinic' ? (
                    <>
                      <option value="all">All Registered Patients</option>
                      <option value="new_patients">
                        New Patients (Last 30 Days)
                      </option>
                      <option value="returning_patients">
                        Returning Patients (Frequent Visits)
                      </option>
                      <option value="upcoming_appointments">
                        Patients with Upcoming Appointments
                      </option>
                      <option value="missed_appointments">
                        Patients with Missed/Cancelled Appointments
                      </option>
                      <option value="due_followup">
                        Patients Due for Routine Follow-up
                      </option>
                      <option value="by_department">
                        Filter Patients by Department
                      </option>
                      <option value="by_doctor">
                        Filter Patients by Referring Doctor
                      </option>
                      <option value="by_gender">
                        Filter Patients by Gender
                      </option>
                      <option value="by_age">
                        Filter Patients by Age Range
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="all">All {audienceLabel}</option>
                    </>
                  )}
                  <option value="contact_list">
                    {audienceLabel} List (Group / Tag)
                  </option>
                  <option value="csv">Upload CSV / Excel File List</option>
                </select>
              </div>

              {/* Dynamic Filter options */}
              {audienceType === 'by_department' && (
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-bold uppercase">
                    Select Department
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                  >
                    <option value="">Choose department...</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Microbiology">Microbiology</option>
                  </select>
                </div>
              )}

              {audienceType === 'by_doctor' && (
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-bold uppercase">
                    Select Referring Doctor
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                  >
                    <option value="">Choose doctor...</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {audienceType === 'by_gender' && (
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-bold uppercase">
                    Patient Gender
                  </label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {audienceType === 'by_age' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-bold uppercase">
                      Minimum Age
                    </label>
                    <input
                      type="number"
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value))}
                      className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-bold uppercase">
                      Maximum Age
                    </label>
                    <input
                      type="number"
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value))}
                      className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                    />
                  </div>
                </div>
              )}

              {audienceType === 'csv' && (
                <div className="border-border/80 bg-muted/20 space-y-4 rounded-xl border p-4">
                  <div className="space-y-2">
                    <label className="text-muted-foreground block text-xs font-bold uppercase">
                      Upload CSV Contact List
                    </label>
                    <div
                      onClick={() =>
                        document.getElementById('csv-file-input')?.click()
                      }
                      className="border-border hover:bg-muted/50 bg-card flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all"
                    >
                      <Upload className="text-muted-foreground mb-2 h-8 w-8" />
                      {csvFileName && csvFileName !== 'Pasted List' ? (
                        <div className="text-center">
                          <p className="text-foreground text-sm font-semibold">
                            {csvFileName}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-emerald-500">
                            {csvContacts.length} contacts parsed successfully
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-foreground text-sm font-semibold">
                            Click to upload CSV file
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Required header: &quot;phone&quot;. Optional:
                            &quot;name&quot;
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id="csv-file-input"
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setCsvFileName(file.name);
                        try {
                          const text = await file.text();
                          const { rows } = parseContactCsv(text);
                          if (rows.length === 0) {
                            toast.error(
                              'No contacts found. Ensure CSV has a "phone" column header.'
                            );
                            return;
                          }
                          const formatted = rows.map((r) => ({
                            phone: r.phone,
                            name: r.name,
                          }));
                          setCsvContacts(formatted);
                          toast.success(
                            `${formatted.length} contacts loaded successfully!`
                          );
                        } catch (err: unknown) {
                          toast.error(
                            'Failed to parse file: ' + (err as Error).message
                          );
                        }
                      }}
                    />
                    <p className="text-muted-foreground mt-1 text-[11px] italic">
                      💡 Tip: If you have an Excel (.xlsx) file, save it as a
                      CSV (.csv) first to upload.
                    </p>
                  </div>

                  <div className="relative flex items-center py-2">
                    <div className="border-border/80 flex-grow border-t"></div>
                    <span className="text-muted-foreground mx-4 flex-shrink text-[10px] font-bold tracking-wider uppercase">
                      Or Paste Numbers
                    </span>
                    <div className="border-border/80 flex-grow border-t"></div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-bold uppercase">
                      Paste Comma or Line Separated Phone Numbers
                    </label>
                    <textarea
                      placeholder="e.g. 919547771118, 919876543210"
                      rows={3}
                      value={
                        csvFileName === 'Pasted List'
                          ? csvContacts.map((c) => c.phone).join(', ')
                          : ''
                      }
                      className="border-border bg-background text-foreground w-full rounded-lg border p-3 font-mono text-sm text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      onChange={(e) => {
                        const text = e.target.value;
                        const numbers = text
                          .split(/[\n,;]/)
                          .map((n) => n.trim().replace(/[^0-9]/g, ''))
                          .filter((n) => n.length >= 8);

                        const formatted = numbers.map((num) => ({
                          phone: num,
                          name: undefined,
                        }));
                        setCsvContacts(formatted);
                        setCsvFileName(
                          formatted.length > 0 ? 'Pasted List' : ''
                        );
                      }}
                    />
                    {csvFileName === 'Pasted List' && (
                      <p className="text-xs font-medium text-emerald-500">
                        {csvContacts.length} numbers ready
                      </p>
                    )}
                  </div>
                </div>
              )}

              {audienceType === 'contact_list' && (
                <div className="border-border/80 bg-muted/20 space-y-4 rounded-xl border p-4">
                  {/* Select or Create List */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        Select Contact List (Tag)
                      </label>
                      <select
                        value={isCreatingNewTag ? 'new_list' : selectedTagId}
                        onChange={(e) => {
                          if (e.target.value === 'new_list') {
                            setIsCreatingNewTag(true);
                            setSelectedTagId('');
                          } else {
                            setIsCreatingNewTag(false);
                            setSelectedTagId(e.target.value);
                          }
                        }}
                        className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm focus:outline-none"
                      >
                        <option value="">-- Choose List --</option>
                        {tags.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                        <option value="new_list">+ Create New List...</option>
                      </select>
                    </div>

                    {isCreatingNewTag && (
                      <div className="animate-in slide-in-from-left-2 space-y-1.5 duration-150">
                        <label className="text-muted-foreground text-xs font-bold uppercase">
                          New List Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Summer Batch"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Add contact manually */}
                  <div className="border-border/80 space-y-2 border-t pt-3">
                    <label className="text-muted-foreground block text-xs font-bold uppercase">
                      Add Contact manually
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder="Contact Name"
                        value={manualContactName}
                        onChange={(e) => setManualContactName(e.target.value)}
                        className="border-border bg-background text-foreground h-10 rounded-lg border px-3 text-sm focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Mobile Number"
                        value={manualContactPhone}
                        onChange={(e) => setManualContactPhone(e.target.value)}
                        className="border-border bg-background text-foreground h-10 rounded-lg border px-3 text-sm focus:outline-none"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (!manualContactPhone.trim()) {
                            toast.error('Mobile Number is required');
                            return;
                          }
                          const newC = {
                            name:
                              manualContactName.trim() ||
                              `Contact ${manualContactPhone.slice(-4)}`,
                            phone: manualContactPhone
                              .trim()
                              .replace(/[^0-9+]/g, ''),
                          };
                          setTempContacts([...tempContacts, newC]);
                          setManualContactName('');
                          setManualContactPhone('');
                          toast.success('Contact added. Click Next to save.');
                        }}
                        className="h-10 cursor-pointer rounded-lg bg-indigo-600 font-semibold text-white hover:bg-indigo-700"
                      >
                        Add Contact
                      </Button>
                    </div>
                  </div>

                  {/* Bulk Upload CSV */}
                  <div className="relative flex items-center py-2">
                    <div className="border-border/80 flex-grow border-t"></div>
                    <span className="text-muted-foreground mx-4 flex-shrink text-[10px] font-bold tracking-wider uppercase">
                      Or Upload CSV in Bulk
                    </span>
                    <div className="border-border/80 flex-grow border-t"></div>
                  </div>

                  <div className="space-y-2">
                    <div
                      onClick={() =>
                        document.getElementById('list-csv-input')?.click()
                      }
                      className="border-border hover:bg-muted/50 bg-card flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-5 transition-all"
                    >
                      <Upload className="text-muted-foreground mb-1 h-6 w-6" />
                      {csvFileName ? (
                        <div className="text-center">
                          <p className="text-foreground text-xs font-semibold">
                            {csvFileName}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-foreground text-xs font-semibold">
                            Click to upload CSV file
                          </p>
                          <p className="text-muted-foreground text-[10px]">
                            Name first, then Mobile Number
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id="list-csv-input"
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setCsvFileName(file.name);
                        try {
                          const text = await file.text();
                          const { rows } = parseContactCsv(text);
                          if (rows.length === 0) {
                            toast.error('No contacts found in CSV.');
                            return;
                          }
                          const formatted = rows.map((r) => ({
                            name: r.name || `Contact ${r.phone.slice(-4)}`,
                            phone: r.phone,
                          }));
                          setTempContacts([...tempContacts, ...formatted]);
                          toast.success(`${formatted.length} contacts loaded.`);
                        } catch (err: unknown) {
                          toast.error(
                            'Failed to parse file: ' + (err as Error).message
                          );
                        }
                      }}
                    />
                  </div>

                  {/* Preview contacts */}
                  {tempContacts.length > 0 && (
                    <div className="border-border/80 space-y-1.5 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-muted-foreground text-xs font-bold uppercase">
                          Contacts to add ({tempContacts.length})
                        </label>
                        <button
                          type="button"
                          onClick={() => setTempContacts([])}
                          className="text-[10px] text-red-500 hover:underline"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="border-border bg-background text-foreground max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2 font-mono text-[11px]">
                        {tempContacts.map((c, i) => (
                          <div
                            key={i}
                            className="border-border/40 animate-in fade-in flex items-center justify-between border-b py-0.5 duration-100 last:border-0"
                          >
                            <span>
                              {c.name} ({c.phone})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setTempContacts(
                                  tempContacts.filter((_, idx) => idx !== i)
                                )
                              }
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setCurrentStep(0)}
                  variant="outline"
                  className="rounded-full px-5 py-2"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(2)}
                  disabled={
                    (audienceType === 'csv' && csvContacts.length === 0) ||
                    (audienceType === 'contact_list' &&
                      !selectedTagId &&
                      !newTagName.trim())
                  }
                  className="rounded-full bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Next: Write Message
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: CONTENT COMPOSER & AI WRITER */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-foreground flex items-center gap-1.5 text-base font-bold">
                  <MessageSquare className="h-4 w-4" /> Message Content
                </h2>
                <div className="bg-muted/40 border-border/50 flex rounded-lg border p-0.5 text-xs">
                  <button
                    onClick={() => setContentMode('custom')}
                    className={`cursor-pointer rounded-md px-3 py-1 transition ${contentMode === 'custom' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                  >
                    Custom Text
                  </button>
                  <button
                    onClick={() => setContentMode('template')}
                    className={`cursor-pointer rounded-md px-3 py-1 transition ${contentMode === 'template' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                  >
                    Approved Template
                  </button>
                </div>
              </div>

              {contentMode === 'custom' ? (
                <div className="space-y-4">
                  {/* AI Writer assistant */}
                  <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <p className="flex items-center gap-1 text-xs font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
                      <Sparkles className="h-3.5 w-3.5" /> AI Campaign Assistant
                    </p>
                    <textarea
                      placeholder="e.g. Tell our pediatric patients about a free polio and measles vaccination drive this Saturday from 10 AM to 2 PM at the clinic lobby. Booking code BOOK."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="border-border bg-background text-foreground h-16 w-full rounded-lg border p-2 text-xs"
                    />
                    <Button
                      onClick={handleAiGenerateText}
                      disabled={writingMessage || !aiPrompt.trim()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                    >
                      {writingMessage ? (
                        <>
                          Generating...{' '}
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Write Campaign
                          Message
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-bold uppercase">
                      WhatsApp Message Body
                    </label>
                    <textarea
                      placeholder="Type your WhatsApp notification message here..."
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="border-border bg-background text-foreground h-36 w-full rounded-lg border p-3 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Optional Attachments */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        Image / Document URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        className="border-border bg-background h-10 w-full rounded-lg border px-3 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        Attachment Type
                      </label>
                      <select
                        value={attachmentType}
                        onChange={(e) =>
                          setAttachmentType(
                            e.target.value as 'image' | 'document'
                          )
                        }
                        className="border-border bg-background h-10 w-full rounded-lg border px-3 text-xs"
                      >
                        <option value="image">Image Attachment</option>
                        <option value="document">
                          PDF Document Attachment
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* CTA Setup */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        CTA Action Type
                      </label>
                      <select
                        value={ctaType}
                        onChange={(e) =>
                          setCtaType(
                            e.target.value as
                              'url' | 'none' | 'appointment' | 'review'
                          )
                        }
                        className="border-border bg-background h-10 w-full rounded-lg border px-3 text-xs"
                      >
                        <option value="none">No Action Button</option>
                        <option value="appointment">
                          Appointment Booking (BOOK)
                        </option>
                        <option value="review">Leave a Review link</option>
                        <option value="url">Redirect Website URL</option>
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        CTA Button Text & URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Button Label"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                          className="border-border bg-background h-10 w-1/2 rounded-lg border px-3 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Link Destination"
                          value={ctaUrl}
                          onChange={(e) => setCtaUrl(e.target.value)}
                          className="border-border bg-background h-10 w-1/2 rounded-lg border px-3 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-bold uppercase">
                      Select Approved Template
                    </label>
                    <select
                      onChange={(e) => {
                        const temp = templates.find(
                          (t) => t.id === e.target.value
                        );
                        setSelectedTemplate(temp || null);
                        setTemplateVariables({});
                      }}
                      className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                    >
                      <option value="">Choose approved template...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.language})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div className="border-border bg-muted/10 space-y-3 rounded-xl border p-4">
                      <p className="text-muted-foreground text-xs font-bold uppercase">
                        Template Body text
                      </p>
                      <p className="text-foreground bg-muted/30 rounded-lg p-2 text-xs whitespace-pre-wrap">
                        {selectedTemplate.body_text}
                      </p>

                      {/* Variable Inputs */}
                      {selectedTemplate.body_text.match(/\{\{\d+\}\}/g) && (
                        <div className="border-border/50 space-y-3 border-t pt-3">
                          <p className="text-muted-foreground text-xs font-bold uppercase">
                            Variables mapping
                          </p>
                          {Array.from(
                            new Set(
                              selectedTemplate.body_text.match(/\{\{\d+\}\}/g)
                            )
                          ).map((match) => {
                            const num = match.replace(/[\{\}]/g, '');
                            const mapVal = templateVariables[num] || {
                              type: 'static',
                              value: '',
                            };
                            return (
                              <div
                                key={num}
                                className="grid grid-cols-3 items-center gap-2"
                              >
                                <span className="text-foreground text-xs font-semibold">
                                  Placeholder {match}
                                </span>
                                <select
                                  value={mapVal.type}
                                  onChange={(e) => {
                                    setTemplateVariables({
                                      ...templateVariables,
                                      [num]: {
                                        type: e.target.value as
                                          'field' | 'custom_field' | 'static',
                                        value: '',
                                      },
                                    });
                                  }}
                                  className="border-border bg-background h-8 rounded border px-2 text-xs"
                                >
                                  <option value="static">Static Text</option>
                                  <option value="field">Contact Field</option>
                                </select>
                                {mapVal.type === 'static' ? (
                                  <input
                                    type="text"
                                    placeholder="Enter static text"
                                    value={mapVal.value}
                                    onChange={(e) => {
                                      setTemplateVariables({
                                        ...templateVariables,
                                        [num]: {
                                          ...mapVal,
                                          value: e.target.value,
                                        },
                                      });
                                    }}
                                    className="border-border bg-background h-8 rounded border px-2 text-xs"
                                  />
                                ) : (
                                  <select
                                    value={mapVal.value}
                                    onChange={(e) => {
                                      setTemplateVariables({
                                        ...templateVariables,
                                        [num]: {
                                          ...mapVal,
                                          value: e.target.value,
                                        },
                                      });
                                    }}
                                    className="border-border bg-background h-8 rounded border px-2 text-xs"
                                  >
                                    <option value="">Select Field...</option>
                                    <option value="name">Name</option>
                                    <option value="phone">Phone</option>
                                    <option value="email">Email</option>
                                    <option value="company">Company</option>
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  className="rounded-full px-5 py-2"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  disabled={
                    contentMode === 'custom'
                      ? !customMessage.trim()
                      : !selectedTemplate
                  }
                  className="rounded-full bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700"
                >
                  Next: Schedule & Confirm
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: SCHEDULE & CONFIRM */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-foreground flex items-center gap-1.5 text-base font-bold">
                <Calendar className="h-4 w-4" /> Schedule Campaign
              </h2>

              <div className="bg-muted/40 border-border/50 flex w-fit rounded-lg border p-0.5 text-xs">
                <button
                  onClick={() => setScheduleMode('immediate')}
                  className={`cursor-pointer rounded-md px-3 py-1 transition ${scheduleMode === 'immediate' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                >
                  Send Immediately
                </button>
                <button
                  onClick={() => setScheduleMode('scheduled')}
                  className={`cursor-pointer rounded-md px-3 py-1 transition ${scheduleMode === 'scheduled' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                >
                  Schedule for Later
                </button>
              </div>

              {scheduleMode === 'scheduled' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        Scheduled Date
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-bold uppercase">
                        Scheduled Time
                      </label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-bold uppercase">
                      Recurring Schedule
                    </label>
                    <select
                      value={recurrence}
                      onChange={(e) =>
                        setRecurrence(
                          e.target.value as
                            'none' | 'weekly' | 'monthly' | 'yearly'
                        )
                      }
                      className="border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm"
                    >
                      <option value="none">One-time Broadcast</option>
                      <option value="weekly">Repeat Weekly</option>
                      <option value="monthly">Repeat Monthly</option>
                      <option value="yearly">Repeat Yearly</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="border-border flex flex-wrap justify-between gap-2 border-t pt-4">
                <Button
                  onClick={() => setCurrentStep(2)}
                  variant="outline"
                  className="rounded-full px-5 py-2"
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveDraft}
                    variant="outline"
                    className="rounded-full border-indigo-600/30 px-5 py-2 text-indigo-600 hover:bg-indigo-600/5 dark:text-indigo-400"
                  >
                    Save Draft
                  </Button>
                  <Button
                    onClick={handleSendOrSchedule}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700"
                  >
                    {isProcessing ? (
                      <>Processing... {progress}%</>
                    ) : scheduleMode === 'scheduled' ? (
                      <>Schedule Campaign</>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Send Campaign
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive WhatsApp Preview Frame */}
        <div className="border-border flex flex-col items-center rounded-2xl border bg-slate-100 p-4 dark:bg-zinc-900">
          <p className="text-muted-foreground mb-3 text-[10px] font-bold tracking-wider uppercase">
            Live WhatsApp Preview
          </p>

          <div className="relative flex aspect-[9/16] w-full max-w-[280px] flex-col justify-between overflow-hidden rounded-3xl border-4 border-zinc-800 bg-zinc-950 p-2 text-left text-zinc-900 shadow-2xl select-none">
            {/* Phone notch */}
            <div className="mx-auto mb-2 flex h-4 w-28 items-center justify-center rounded-full bg-zinc-800">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-900"></span>
            </div>

            {/* Chat Area */}
            <div className="relative flex flex-1 flex-col justify-end space-y-2 overflow-y-auto rounded-2xl bg-zinc-900/40 p-2">
              {/* Floating Campaign Card */}
              <div className="max-w-[90%] space-y-2 self-start rounded-xl border border-zinc-200/20 bg-white p-3 shadow-md dark:bg-zinc-950">
                {attachmentUrl && (
                  <div className="flex min-h-[80px] items-center justify-center overflow-hidden rounded-lg border border-zinc-200/10 bg-zinc-100 p-2 dark:bg-zinc-900">
                    {attachmentType === 'image' ? (
                      <ImageIcon className="h-8 w-8 text-zinc-400" />
                    ) : (
                      <FileText className="h-8 w-8 text-zinc-400" />
                    )}
                  </div>
                )}

                <p className="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">
                  {contentMode === 'custom'
                    ? customMessage || 'Write your message in the composer...'
                    : selectedTemplate?.body_text || 'Select a template...'}
                </p>

                {ctaType !== 'none' && (
                  <div className="flex flex-col gap-1.5 border-t border-zinc-100/50 pt-2">
                    {ctaType === 'appointment' && (
                      <div className="w-full rounded-lg bg-indigo-600 py-1.5 text-center text-[10px] font-bold text-white">
                        💬 Reply BOOK
                      </div>
                    )}
                    {ctaType === 'review' && (
                      <div className="flex w-full items-center justify-center gap-1 rounded-lg border border-indigo-600/30 py-1.5 text-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        ⭐ {ctaText || 'Leave a Review'}
                      </div>
                    )}
                    {ctaType === 'url' && (
                      <div className="flex w-full items-center justify-center gap-1 rounded-lg border border-indigo-600/30 py-1.5 text-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        🌐 {ctaText || 'Visit Link'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bot Auto-booking Reply Mock */}
              {ctaType === 'appointment' && (
                <div className="max-w-[85%] self-end rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-[10px] text-zinc-300 shadow-sm">
                  <p className="font-bold text-emerald-400">
                    Patient Response:
                  </p>
                  <p className="mt-0.5 font-semibold text-white">BOOK</p>
                  <p className="mt-1.5 font-bold text-indigo-400">Helpa AI:</p>
                  <p className="mt-0.5 text-zinc-400 italic">
                    &quot;Starting booking... Please provide doctor name &amp;
                    time.&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Input Area Mock */}
            <div className="mt-2 flex items-center gap-1 border-t border-zinc-800 px-1 pt-2">
              <div className="flex h-6 flex-1 items-center rounded-full border border-zinc-800 bg-zinc-900 px-2">
                <span className="text-[9px] text-zinc-600">Message...</span>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600">
                <Send className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
