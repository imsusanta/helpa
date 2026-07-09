'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { MessageTemplate } from '@/types';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';
import { 
  ArrowLeft, 
  Sparkles, 
  Send, 
  FileText, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Calendar, 
  Users, 
  Clock, 
  Check, 
  Bot, 
  Loader2, 
  MessageSquare,
  Globe,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DoctorOption {
  id: string;
  name: string;
  department: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountId } = useAuth();
  const { createAndSendBroadcast, isProcessing, progress } = useBroadcastSending();

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
  const [audienceType, setAudienceType] = useState<'all' | 'new_patients' | 'returning_patients' | 'upcoming_appointments' | 'missed_appointments' | 'due_followup' | 'by_department' | 'by_doctor' | 'by_gender' | 'by_age'>('all');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedGender, setSelectedGender] = useState('Male');
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(100);

  // Content Mode: 'custom' or 'template'
  const [contentMode, setContentMode] = useState<'custom' | 'template'>('custom');
  
  // Custom message states
  const [customMessage, setCustomMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'image' | 'document'>('image');
  const [ctaType, setCtaType] = useState<'none' | 'appointment' | 'review' | 'url'>('none');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  // AI Campaign Writer helper state
  const [aiPrompt, setAiPrompt] = useState('');
  const [writingMessage, setWritingMessage] = useState(false);

  // Template Mode states
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, { type: 'static' | 'field' | 'custom_field'; value: string }>>({});

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'monthly' | 'yearly'>('none');

  // Load configuration lists
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ═══════ ON MOUNT ═══════
  useEffect(() => {
    if (!accountId) return;

    async function loadConfig() {
      try {
        const supabase = createClient();
        
        // 1. Fetch active doctors
        const { data: docData } = await supabase
          .from('hospital_doctors')
          .select('id, name, department')
          .eq('account_id', accountId)
          .eq('status', 'active');
        setDoctors(docData || []);

        // 2. Fetch approved Meta templates
        const { data: tempRows } = await supabase
          .from('message_templates')
          .select('*')
          .eq('account_id', accountId)
          .eq('status', 'APPROVED');
        setTemplates(tempRows || []);

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
      setAiPrompt('Write a follow-up reminder inviting patients who haven\'t visited in 6 months for a comprehensive annual checkup at our clinic.');
    } else if (suggestionType === 'missed') {
      setAudienceType('missed_appointments');
      setCategory('Follow-up Reminder');
      setName('Appointment Re-booking Campaign');
      setAiPrompt('Write a polite and helpful message to patients who missed their appointments this month, asking them if they would like to re-book. Prompt them to reply BOOK.');
    } else if (suggestionType === 'followup') {
      setAudienceType('due_followup');
      setCategory('Health Camp');
      setName('Diabetic Camp Follow-up Reminder');
      setAiPrompt('Write an invitation to diabetic patients for a routine blood glucose test and follow-up appointment this week.');
    }
  }, [accountId, searchParams]);

  // ═══════ AI WRITER TRIGGER ═══════
  async function handleAiGenerateText() {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a brief campaign topic for the AI to write about.');
      return;
    }
    setWritingMessage(true);
    try {
      const activeDoc = doctors.find(d => d.id === selectedDoctorId);
      const res = await fetch('/api/campaigns/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          prompt: aiPrompt,
          doctorName: activeDoc?.name || '',
          department: selectedDept || activeDoc?.department || ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to write message');

      setCustomMessage(data.message || '');
      toast.success('AI Campaign Message generated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'AI writer failed');
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
      const supabase = createClient();
      
      const draftPayload = {
        account_id: accountId,
        user_id: (await supabase.auth.getSession()).data.session?.user.id,
        name: name.trim(),
        template_name: contentMode === 'template' ? selectedTemplate?.name || 'custom_draft' : 'custom_campaign',
        template_language: contentMode === 'template' ? selectedTemplate?.language || 'en_US' : 'en_US',
        status: 'draft' as const,
        total_recipients: 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        replied_count: 0,
        failed_count: 0,
        category,
        message_body: contentMode === 'custom' ? customMessage : null,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentUrl ? attachmentType : null,
        cta_type: ctaType,
        cta_text: ctaText || null,
        cta_url: ctaUrl || null,
        recurrence,
        ai_suggested: !!searchParams.get('suggestion'),
        audience_filter: {
          type: audienceType,
          department: selectedDept || null,
          doctorId: selectedDoctorId || null,
          gender: selectedGender || null,
          ageMin: ageMin || null,
          ageMax: ageMax || null,
        }
      };

      const { error } = await supabase.from('broadcasts').insert(draftPayload);
      if (error) throw error;

      toast.success('Campaign draft saved successfully');
      router.push('/broadcasts');
    } catch (err: any) {
      toast.error(`Draft Save Error: ${err.message}`);
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
      // Mocking template structure for custom campaigns so useBroadcastSending executes natively
      let finalTemplate: MessageTemplate;
      let finalVariables: any = {};

      if (contentMode === 'custom') {
        // Construct a synthetic template row
        finalTemplate = {
          id: 'custom-text',
          name: name.replace(/\s+/g, '_').toLowerCase(),
          body_text: customMessage,
          category: 'Marketing',
          created_at: new Date().toISOString()
        } as any;
      } else {
        finalTemplate = selectedTemplate!;
        finalVariables = templateVariables;
      }

      const scheduledAt = scheduleMode === 'scheduled' 
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : undefined;

      const broadcastId = await createAndSendBroadcast({
        name,
        template: finalTemplate,
        audience: {
          type: audienceType,
          department: selectedDept || undefined,
          doctorId: selectedDoctorId || undefined,
          gender: selectedGender || undefined,
          ageMin: ageMin || undefined,
          ageMax: ageMax || undefined,
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
        ai_suggested: !!searchParams.get('suggestion')
      } as any);

      toast.success(scheduleMode === 'scheduled' ? 'Campaign scheduled successfully!' : 'Campaign dispatched successfully!');
      router.push(`/broadcasts/${broadcastId}`);
    } catch (err: any) {
      toast.error(err.message || 'Campaign execution failed.');
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
    'General Announcement'
  ];

  if (loadingConfig) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
          className="rounded-full h-8 w-8 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Campaign Builder</h1>
          <p className="text-xs text-muted-foreground">
            Create structured patient notifications, segment your patient base, and schedule delivery.
          </p>
        </div>
      </div>

      {/* Stepper progress indicator */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-muted-foreground border-b border-border/50 pb-4">
        <div className={`pb-2 border-b-2 transition ${currentStep === 0 ? 'text-indigo-600 border-indigo-600' : 'border-transparent'}`}>1. Settings</div>
        <div className={`pb-2 border-b-2 transition ${currentStep === 1 ? 'text-indigo-600 border-indigo-600' : 'border-transparent'}`}>2. Audience</div>
        <div className={`pb-2 border-b-2 transition ${currentStep === 2 ? 'text-indigo-600 border-indigo-600' : 'border-transparent'}`}>3. Composer</div>
        <div className={`pb-2 border-b-2 transition ${currentStep === 3 ? 'text-indigo-600 border-indigo-600' : 'border-transparent'}`}>4. Confirm</div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.8fr_1.2fr]">
        
        {/* Left Side: Wizard Forms */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5 text-left">
          
          {/* STEP 0: SETTINGS */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-1.5"><Settings className="h-4 w-4" /> Campaign Settings</h2>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology Free Health Camp July"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Campaign Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={() => setCurrentStep(1)}
                  disabled={!name.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 py-2"
                >
                  Next: Choose Audience
                </Button>
              </div>
            </div>
          )}

          {/* STEP 1: AUDIENCE SEGMENTATION */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-1.5"><Users className="h-4 w-4" /> Target Patients Segment</h2>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Target Audience Type</label>
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Registered Patients</option>
                  <option value="new_patients">New Patients (Last 30 Days)</option>
                  <option value="returning_patients">Returning Patients (Frequent Visits)</option>
                  <option value="upcoming_appointments">Patients with Upcoming Appointments</option>
                  <option value="missed_appointments">Patients with Missed/Cancelled Appointments</option>
                  <option value="due_followup">Patients Due for Routine Follow-up</option>
                  <option value="by_department">Filter Patients by Department</option>
                  <option value="by_doctor">Filter Patients by Referring Doctor</option>
                  <option value="by_gender">Filter Patients by Gender</option>
                  <option value="by_age">Filter Patients by Age Range</option>
                </select>
              </div>

              {/* Dynamic Filter options */}
              {audienceType === 'by_department' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Select Department</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
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
                  <label className="text-xs font-bold text-muted-foreground uppercase">Select Referring Doctor</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                  >
                    <option value="">Choose doctor...</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>{doc.name} ({doc.department})</option>
                    ))}
                  </select>
                </div>
              )}

              {audienceType === 'by_gender' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Patient Gender</label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
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
                    <label className="text-xs font-bold text-muted-foreground uppercase">Minimum Age</label>
                    <input
                      type="number"
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Maximum Age</label>
                    <input
                      type="number"
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-between">
                <Button
                  onClick={() => setCurrentStep(0)}
                  variant="outline"
                  className="rounded-full px-5 py-2"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(2)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 py-2"
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
                <h2 className="text-base font-bold text-foreground flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Message Content</h2>
                <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/50 text-xs">
                  <button 
                    onClick={() => setContentMode('custom')} 
                    className={`px-3 py-1 rounded-md cursor-pointer transition ${contentMode === 'custom' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                  >
                    Custom Text
                  </button>
                  <button 
                    onClick={() => setContentMode('template')} 
                    className={`px-3 py-1 rounded-md cursor-pointer transition ${contentMode === 'template' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                  >
                    Approved Template
                  </button>
                </div>
              </div>

              {contentMode === 'custom' ? (
                <div className="space-y-4">
                  {/* AI Writer assistant */}
                  <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> AI Campaign Assistant
                    </p>
                    <textarea
                      placeholder="e.g. Tell our pediatric patients about a free polio and measles vaccination drive this Saturday from 10 AM to 2 PM at the clinic lobby. Booking code BOOK."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full h-16 p-2 text-xs rounded-lg border border-border bg-background text-foreground"
                    />
                    <Button
                      onClick={handleAiGenerateText}
                      disabled={writingMessage || !aiPrompt.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs py-1 px-3 w-full flex items-center justify-center gap-1.5"
                    >
                      {writingMessage ? (
                        <>Generating... <Loader2 className="h-3 w-3 animate-spin" /></>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5" /> Write Campaign Message</>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">WhatsApp Message Body</label>
                    <textarea
                      placeholder="Type your WhatsApp notification message here..."
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="w-full h-36 p-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none"
                    />
                  </div>

                  {/* Optional Attachments */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Image / Document URL</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Attachment Type</label>
                      <select
                        value={attachmentType}
                        onChange={(e) => setAttachmentType(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs"
                      >
                        <option value="image">Image Attachment</option>
                        <option value="document">PDF Document Attachment</option>
                      </select>
                    </div>
                  </div>

                  {/* CTA Setup */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">CTA Action Type</label>
                      <select
                        value={ctaType}
                        onChange={(e) => setCtaType(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs"
                      >
                        <option value="none">No Action Button</option>
                        <option value="appointment">Appointment Booking (BOOK)</option>
                        <option value="review">Leave a Review link</option>
                        <option value="url">Redirect Website URL</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase">CTA Button Text & URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Button Label"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                          className="w-1/2 h-10 px-3 rounded-lg border border-border bg-background text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Link Destination"
                          value={ctaUrl}
                          onChange={(e) => setCtaUrl(e.target.value)}
                          className="w-1/2 h-10 px-3 rounded-lg border border-border bg-background text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Select Approved Template</label>
                    <select
                      onChange={(e) => {
                        const temp = templates.find((t) => t.id === e.target.value);
                        setSelectedTemplate(temp || null);
                        setTemplateVariables({});
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    >
                      <option value="">Choose approved template...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Template Body text</p>
                      <p className="text-xs text-foreground bg-muted/30 p-2 rounded-lg whitespace-pre-wrap">{selectedTemplate.body_text}</p>
                      
                      {/* Variable Inputs */}
                      {selectedTemplate.body_text.match(/\{\{\d+\}\}/g) && (
                        <div className="space-y-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-bold text-muted-foreground uppercase">Variables mapping</p>
                          {Array.from(new Set(selectedTemplate.body_text.match(/\{\{\d+\}\}/g))).map((match) => {
                            const num = match.replace(/[\{\}]/g, '');
                            const mapVal = templateVariables[num] || { type: 'static', value: '' };
                            return (
                              <div key={num} className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-xs text-foreground font-semibold">Placeholder {match}</span>
                                <select
                                  value={mapVal.type}
                                  onChange={(e) => {
                                    setTemplateVariables({
                                      ...templateVariables,
                                      [num]: { type: e.target.value as any, value: '' }
                                    });
                                  }}
                                  className="h-8 px-2 rounded border border-border bg-background text-xs"
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
                                        [num]: { ...mapVal, value: e.target.value }
                                      });
                                    }}
                                    className="h-8 px-2 rounded border border-border bg-background text-xs"
                                  />
                                ) : (
                                  <select
                                    value={mapVal.value}
                                    onChange={(e) => {
                                      setTemplateVariables({
                                        ...templateVariables,
                                        [num]: { ...mapVal, value: e.target.value }
                                      });
                                    }}
                                    className="h-8 px-2 rounded border border-border bg-background text-xs"
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

              <div className="pt-4 flex justify-between">
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  className="rounded-full px-5 py-2"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  disabled={contentMode === 'custom' ? !customMessage.trim() : !selectedTemplate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 py-2"
                >
                  Next: Schedule & Confirm
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: SCHEDULE & CONFIRM */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Schedule Campaign</h2>
              
              <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/50 text-xs w-fit">
                <button 
                  onClick={() => setScheduleMode('immediate')} 
                  className={`px-3 py-1 rounded-md cursor-pointer transition ${scheduleMode === 'immediate' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                >
                  Send Immediately
                </button>
                <button 
                  onClick={() => setScheduleMode('scheduled')} 
                  className={`px-3 py-1 rounded-md cursor-pointer transition ${scheduleMode === 'scheduled' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground'}`}
                >
                  Schedule for Later
                </button>
              </div>

              {scheduleMode === 'scheduled' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Scheduled Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Scheduled Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Recurring Schedule</label>
                    <select
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                    >
                      <option value="none">One-time Broadcast</option>
                      <option value="weekly">Repeat Weekly</option>
                      <option value="monthly">Repeat Monthly</option>
                      <option value="yearly">Repeat Yearly</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 flex flex-wrap gap-2 justify-between">
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
                    className="border-indigo-600/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/5 rounded-full px-5 py-2"
                  >
                    Save Draft
                  </Button>
                  <Button
                    onClick={handleSendOrSchedule}
                    disabled={isProcessing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 py-2 flex items-center gap-1.5"
                  >
                    {isProcessing ? (
                      <>Processing... {progress}%</>
                    ) : scheduleMode === 'scheduled' ? (
                      <>Schedule Campaign</>
                    ) : (
                      <><Send className="h-4 w-4" /> Send Campaign</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Interactive WhatsApp Preview Frame */}
        <div className="bg-slate-100 dark:bg-zinc-900 border border-border rounded-2xl p-4 flex flex-col items-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Live WhatsApp Preview</p>
          
          <div className="w-full max-w-[280px] rounded-3xl border-4 border-zinc-800 bg-zinc-950 p-2 shadow-2xl relative overflow-hidden flex flex-col justify-between aspect-[9/16] text-left text-zinc-900 select-none">
            
            {/* Phone notch */}
            <div className="mx-auto mb-2 h-4 w-28 rounded-full bg-zinc-800 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-900"></span>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-zinc-900/40 rounded-2xl p-2 flex flex-col justify-end space-y-2 relative overflow-y-auto">
              
              {/* Floating Campaign Card */}
              <div className="rounded-xl bg-white dark:bg-zinc-950 p-3 shadow-md border border-zinc-200/20 max-w-[90%] self-start space-y-2">
                {attachmentUrl && (
                  <div className="rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 p-2 border border-zinc-200/10 flex items-center justify-center min-h-[80px]">
                    {attachmentType === 'image' ? (
                      <ImageIcon className="h-8 w-8 text-zinc-400" />
                    ) : (
                      <FileText className="h-8 w-8 text-zinc-400" />
                    )}
                  </div>
                )}
                
                <p className="text-[11px] leading-relaxed break-words text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">
                  {contentMode === 'custom' ? (
                    customMessage || 'Write your message in the composer...'
                  ) : (
                    selectedTemplate?.body_text || 'Select a template...'
                  )}
                </p>

                {ctaType !== 'none' && (
                  <div className="border-t border-zinc-100/50 pt-2 flex flex-col gap-1.5">
                    {ctaType === 'appointment' && (
                      <div className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-center text-[10px] font-bold">
                        💬 Reply BOOK
                      </div>
                    )}
                    {ctaType === 'review' && (
                      <div className="w-full py-1.5 border border-indigo-600/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-center text-[10px] font-bold flex items-center justify-center gap-1">
                        ⭐ {ctaText || 'Leave a Review'}
                      </div>
                    )}
                    {ctaType === 'url' && (
                      <div className="w-full py-1.5 border border-indigo-600/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-center text-[10px] font-bold flex items-center justify-center gap-1">
                        🌐 {ctaText || 'Visit Link'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bot Auto-booking Reply Mock */}
              {ctaType === 'appointment' && (
                <div className="rounded-xl bg-zinc-950 p-2.5 shadow-sm border border-zinc-800 text-[10px] max-w-[85%] self-end text-zinc-300">
                  <p className="font-bold text-emerald-400">Patient Response:</p>
                  <p className="mt-0.5 font-semibold text-white">BOOK</p>
                  <p className="mt-1.5 font-bold text-indigo-400">Helpa AI:</p>
                  <p className="mt-0.5 italic text-zinc-400">"Starting booking... Please provide doctor name & time."</p>
                </div>
              )}
            </div>

            {/* Bottom Input Area Mock */}
            <div className="mt-2 flex items-center gap-1 border-t border-zinc-800 pt-2 px-1">
              <div className="flex-1 h-6 rounded-full bg-zinc-900 border border-zinc-800 px-2 flex items-center">
                <span className="text-[9px] text-zinc-600">Message...</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center">
                <Send className="h-3 w-3 text-white" />
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
