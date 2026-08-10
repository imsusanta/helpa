'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/appwrite-compat';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { getIndustryModule } from '@/modules/registry';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
  onViewExisting?: (contactId: string) => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
  onViewExisting,
}: ContactFormProps) {
  const appwrite = createClient();
  const { accountId, account } = useAuth();
  const isEdit = !!contact;

  // Active industry configuration
  const industryModule = getIndustryModule(account?.industry);
  const contactConfig = industryModule.entityConfigs?.contacts;
  const entityLabel = contactConfig?.label || 'Contact';
  const customFields = contactConfig?.fields || [];
  const isHospitalWorkspace = industryModule.id === 'hospital_clinic';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Duplicate-phone detection for NEW contacts.
  const [dupMatch, setDupMatch] = useState<{
    contact: ExistingContact;
    exact: boolean;
  } | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    const { data } = await appwrite.from('tags').select('*').order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }, [appwrite]);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setEmail(contact?.email ?? '');
      setAddress(contact?.address ?? '');
      setNotes(contact?.notes ?? '');
      setMetadata((contact?.metadata as Record<string, unknown>) ?? {});
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      setDupMatch(null);
      fetchTags();
    }
  }, [open, contact, contactTags, fetchTags]);

  async function checkDuplicate() {
    if (isEdit || !accountId) return;
    const value = phone.trim();
    if (!value) {
      setDupMatch(null);
      return;
    }
    setCheckingDup(true);
    try {
      const existing = await findExistingContact(appwrite, accountId, value);
      setDupMatch(
        existing
          ? { contact: existing, exact: isExactMatch(existing, value) }
          : null
      );
    } finally {
      setCheckingDup(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    if (!isEdit && !isHospitalWorkspace && dupMatch?.exact) {
      toast.error(
        `A ${entityLabel.toLowerCase()} with this phone number already exists`
      );
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !metadata[field.key]) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await appwrite.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');
      if (!accountId)
        throw new Error('Your profile is not linked to an account.');

      let contactId = contact?.id;
      const contactMetadata = { ...metadata };

      // Patient IDs are always created by the database after the contact is
      // saved, never accepted from the form.
      if (isHospitalWorkspace && !isEdit) {
        delete contactMetadata.patient_id;
      }

      const payload = {
        name: name.trim() || null,
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        industry: account?.industry || 'general',
        entity_type: entityLabel,
        metadata: contactMetadata,
      };

      if (isEdit && contactId) {
        const { error } = await appwrite
          .from('contacts')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await appwrite
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            ...payload,
          })
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      if (isHospitalWorkspace && contactId) {
        const { data: existingPatient } = await appwrite
          .from('patients')
          .select('patient_seq_id, blood_group')
          .eq('id', contactId)
          .maybeSingle();

        let seqId = existingPatient?.patient_seq_id;
        const meta = contactMetadata as Record<string, unknown>;
        const inputBloodGroup =
          (meta.blood_group as string) ||
          (meta['Blood Group'] as string) ||
          null;

        if (!existingPatient) {
          const { data: maxPatient } = await appwrite
            .from('patients')
            .select('patient_seq_id')
            .eq('account_id', accountId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let nextNum = 1;
          if (maxPatient?.patient_seq_id) {
            const numMatch = maxPatient.patient_seq_id.match(/\d+/);
            if (numMatch) {
              nextNum = parseInt(numMatch[0], 10) + 1;
            }
          }

          seqId = `PAT-${String(nextNum).padStart(6, '0')}`;

          await appwrite.from('patients').insert({
            id: contactId,
            account_id: accountId,
            patient_seq_id: seqId,
            blood_group: inputBloodGroup,
            status: 'active',
          });
        } else if (
          inputBloodGroup &&
          inputBloodGroup !== existingPatient.blood_group
        ) {
          await appwrite
            .from('patients')
            .update({ blood_group: inputBloodGroup })
            .eq('id', contactId);
        }

        if (seqId) {
          await appwrite
            .from('contacts')
            .update({
              metadata: {
                ...contactMetadata,
                patient_id: seqId,
                ...(inputBloodGroup ? { blood_group: inputBloodGroup } : {}),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', contactId);
        }
      }

      // Sync tags
      if (contactId) {
        await appwrite
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tag_id) => ({
            contact_id: contactId!,
            tag_id,
          }));
          const { error: tagError } = await appwrite
            .from('contact_tags')
            .insert(tagRows);
          if (tagError) throw tagError;
        }
      }

      toast.success(
        isEdit ? `${entityLabel} updated` : `${entityLabel} created`
      );
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        if (isHospitalWorkspace) {
          toast.error(
            'Could not assign a unique Patient ID. Please try again.'
          );
          return;
        }
        toast.error(
          `A ${entityLabel.toLowerCase()} with this phone number already exists`
        );
        if (!isEdit && accountId) {
          const existing = await findExistingContact(
            appwrite,
            accountId,
            phone.trim()
          );
          if (existing) setDupMatch({ contact: existing, exact: true });
        }
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Failed to save contact';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? `Update the ${entityLabel.toLowerCase()} details below.`
              : `Fill in the details to create a new ${entityLabel.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-name" className="text-muted-foreground">
              Full Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-phone" className="text-muted-foreground">
              Mobile Number <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (dupMatch) setDupMatch(null);
              }}
              onBlur={checkDuplicate}
              placeholder="+1 234 567 8900"
              required
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {dupMatch ? (
              <div
                className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                  dupMatch.exact && !isHospitalWorkspace
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div className="space-y-1">
                  <p>
                    {dupMatch.exact && isHospitalWorkspace
                      ? 'This mobile number is already used by another patient. You can add this patient with a new Patient ID.'
                      : dupMatch.exact
                        ? `A ${entityLabel.toLowerCase()} with this phone number already exists.`
                        : `A ${entityLabel.toLowerCase()} with a very similar number already exists.`}
                  </p>
                  {onViewExisting && (
                    <button
                      type="button"
                      onClick={() => onViewExisting(dupMatch.contact.id)}
                      className="font-medium underline underline-offset-2 hover:no-underline"
                    >
                      View {dupMatch.contact.name || dupMatch.contact.phone}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Include country code, e.g. +1 for US
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-email" className="text-muted-foreground">
              Email
            </Label>
            <Input
              id="cf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-address" className="text-muted-foreground">
              Address
            </Label>
            <Input
              id="cf-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Industry Custom Fields */}
          {customFields.length > 0 && (
            <div className="border-border/50 space-y-4 border-t pt-2">
              <span className="text-primary block text-xs font-semibold uppercase">
                {entityLabel} Information
              </span>
              {customFields.map((field) => {
                const value = (metadata[field.key] as string | number) ?? '';
                const isGeneratedPatientId =
                  isHospitalWorkspace && field.key === 'patient_id';
                const handleChange = (val: unknown) => {
                  setMetadata((prev) => ({ ...prev, [field.key]: val }));
                };

                return (
                  <div key={field.key} className="space-y-2">
                    <Label
                      htmlFor={`cf-${field.key}`}
                      className="text-muted-foreground"
                    >
                      {field.label}{' '}
                      {isGeneratedPatientId
                        ? '(assigned automatically)'
                        : field.required && (
                            <span className="text-red-400">*</span>
                          )}
                    </Label>
                    {isGeneratedPatientId ? (
                      <Input
                        id={`cf-${field.key}`}
                        value={value || 'Assigned after saving'}
                        disabled
                        className="bg-muted border-border text-muted-foreground"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={`cf-${field.key}`}
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        className="border-border bg-muted text-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                      >
                        <option value="">Select option...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'number' ? (
                      <Input
                        id={`cf-${field.key}`}
                        type="number"
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                      />
                    ) : field.type === 'date' ? (
                      <Input
                        id={`cf-${field.key}`}
                        type="date"
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        className="bg-muted border-border text-foreground"
                      />
                    ) : (
                      <Input
                        id={`cf-${field.key}`}
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cf-notes" className="text-muted-foreground">
              Notes
            </Label>
            <Input
              id="cf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional comments..."
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Tags</Label>
            {loadingTags ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-3 animate-spin" />
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No tags available. Create tags in Settings.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'ring-primary ring-offset-border ring-2 ring-offset-1'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="bg-popover border-border border-border/50 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || checkingDup || (!isEdit && !!dupMatch?.exact)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
