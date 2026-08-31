'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/db/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, Profile } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MessageSquare,
  Download,
  Tag as TagIcon,
  UserCheck,
  Clock,
  TrendingUp,
  Flame,
  UserX,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/use-workspace';
import { SendOutboundModal } from '@/components/contacts/send-outbound-modal';
import { ContactForm } from '@/components/contacts/contact-form';
import { useRouter } from 'next/navigation';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { Checkbox } from '@/components/ui/checkbox';
import { SavedFilterBar } from '@/components/crm/saved-filter-bar';
import { getOrGeneratePatientId } from '@/lib/patients/id-generator';
import {
  formatWhatsAppDisplayPhone,
  isIndividualContact,
  whatsappContactDisplayName,
} from '@/core/whatsapp/group-identity';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return '—';
  const diffSec = Math.floor((now - time) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function renderLeadScoreBadge(scoreVal?: unknown) {
  const num = typeof scoreVal === 'number' ? scoreVal : Number(scoreVal);
  const str = String(scoreVal || '').toLowerCase();
  if ((!isNaN(num) && num >= 70) || str === 'hot') {
    return (
      <Badge className="gap-1 border-red-500/30 bg-red-500/10 text-[10px] font-bold text-red-600 dark:text-red-400">
        <Flame className="size-2.5" />
        Hot {!isNaN(num) ? `(${num})` : ''}
      </Badge>
    );
  }
  if ((!isNaN(num) && num >= 40) || str === 'warm') {
    return (
      <Badge className="gap-1 border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <span>🟡</span>
        Warm {!isNaN(num) ? `(${num})` : ''}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 border-blue-500/30 bg-blue-500/10 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
      <span>🔵</span>
      Cold {!isNaN(num) && num > 0 ? `(${num})` : ''}
    </Badge>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const appwrite = useMemo(() => createClient(), []);
  const { account, user } = useAuth();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  // Industry-specific entity configurations
  const industryModule = getIndustryModule(account?.industry);
  const contactConfig = industryModule.entityConfigs?.contacts;
  const { terminology } = useWorkspace();
  const entityLabel = terminology.person;
  const entityLabelPlural = terminology.people;
  const _customFields = contactConfig?.fields || [];

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [outboundModalOpen, setOutboundModalOpen] = useState(false);
  const [selectedOutboundContact, setSelectedOutboundContact] =
    useState<Contact | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection & actions state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkRemoveTagOpen, setBulkRemoveTagOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [bulkFollowupOpen, setBulkFollowupOpen] = useState(false);

  const [bulkTagId, setBulkTagId] = useState('');
  const [bulkRemoveTagId, setBulkRemoveTagId] = useState('');
  const [bulkAssignUserId, setBulkAssignUserId] = useState('');
  const [bulkStage, setBulkStage] = useState('NEW');
  const [bulkTaskTitle, setBulkTaskTitle] = useState('Follow-up Call');
  const [bulkTaskDueDate, setBulkTaskDueDate] = useState('');
  const [bulkTaskUserId, setBulkTaskUserId] = useState('');
  const [bulkTaskNotes, setBulkTaskNotes] = useState('');

  const [allAvailableTags, setAllAvailableTags] = useState<Tag[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // Smart filter states
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'leads' | 'customers' | 'inactive'
  >('all');
  const [assignmentFilter, setAssignmentFilter] = useState<
    'everyone' | 'me' | 'unassigned'
  >('everyone');
  const [tempFilter, setTempFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>(
    'all'
  );
  const [whatsappFilter, setWhatsappFilter] = useState<
    'all' | 'connected' | 'no_whatsapp'
  >('all');
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'recent' | 'inactive'
  >('all');

  // All tags for display
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const tagsMapRef = useRef(tagsMap);

  useEffect(() => {
    tagsMapRef.current = tagsMap;
  }, [tagsMap]);

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    allProfiles.forEach((p) => {
      if (p.id) map[p.id] = p;
      if (p.user_id) map[p.user_id] = p;
    });
    return map;
  }, [allProfiles]);

  const myContactsCount = useMemo(() => {
    const myId = user?.id;
    return contacts.filter(
      (c) =>
        c.assigned_user_id === myId ||
        (c.metadata as Record<string, unknown>)?.assigned_user_id === myId
    ).length;
  }, [contacts, user?.id]);

  const unassignedCount = useMemo(() => {
    return contacts.filter(
      (c) =>
        !c.assigned_user_id &&
        !(c.metadata as Record<string, unknown>)?.assigned_user_id
    ).length;
  }, [contacts]);

  const newThisWeekCount = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return contacts.filter((c) => c.created_at >= sevenDaysAgo).length;
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const meta = (c.metadata || {}) as Record<string, unknown>;
      const stage = String(meta.stage || '').toUpperCase();
      const entityType = String(c.entity_type || meta.type || '').toLowerCase();
      const isLead = stage.length > 0 || entityType.includes('lead');
      const isCustomer = !isLead;

      // Status filter
      if (statusFilter === 'leads' && !isLead) return false;
      if (statusFilter === 'customers' && !isCustomer) return false;
      if (statusFilter === 'inactive' && meta.status !== 'inactive')
        return false;

      // Assignment filter
      if (assignmentFilter === 'me' && c.assigned_user_id !== user?.id)
        return false;
      if (assignmentFilter === 'unassigned' && Boolean(c.assigned_user_id))
        return false;

      // Lead temperature
      const scoreNum = Number(meta.ai_lead_score || meta.score || 50);
      const scoreStr = String(
        meta.ai_lead_score || meta.score || ''
      ).toLowerCase();
      if (tempFilter === 'hot' && !(scoreNum >= 70 || scoreStr === 'hot'))
        return false;
      if (
        tempFilter === 'warm' &&
        !((scoreNum >= 40 && scoreNum < 70) || scoreStr === 'warm')
      )
        return false;
      if (tempFilter === 'cold' && !(scoreNum < 40 || scoreStr === 'cold'))
        return false;

      // WhatsApp
      const hasPhone = Boolean(
        c.phone && c.phone.replace(/\D/g, '').length >= 10
      );
      if (whatsappFilter === 'connected' && !hasPhone) return false;
      if (whatsappFilter === 'no_whatsapp' && hasPhone) return false;

      // Activity
      const lastAct = c.updated_at || c.created_at;
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      if (activityFilter === 'recent' && lastAct < sevenDaysAgo) return false;
      if (activityFilter === 'inactive' && lastAct >= sevenDaysAgo)
        return false;

      return true;
    });
  }, [
    contacts,
    statusFilter,
    assignmentFilter,
    tempFilter,
    whatsappFilter,
    activityFilter,
    user?.id,
  ]);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await appwrite.from('tags').select('*');
      if (data) {
        setAllAvailableTags(data);
        const map: Record<string, Tag> = {};
        data.forEach((t) => (map[t.id] = t));
        setTagsMap(map);
      }
    } catch (err) {
      console.warn('[ContactsPage] Failed to load tags:', err);
    }
  }, [appwrite]);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data } = await appwrite
        .from('profiles')
        .select('*')
        .order('full_name');
      if (data) setAllProfiles(data);
    } catch (err) {
      console.warn('[ContactsPage] Failed to load profiles:', err);
    }
  }, [appwrite]);

  const handleExportCsv = (selectedOnly = false) => {
    const url =
      selectedOnly && selected.size > 0
        ? `/api/contacts/export?ids=${[...selected].join(',')}`
        : `/api/contacts/export?search=${encodeURIComponent(search)}`;
    window.open(url, '_blank');
    toast.success('Downloading contacts export CSV...');
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignUserId) {
      toast.error('Please select a team member');
      return;
    }
    const ids = [...selected];
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          contact_ids: ids,
          payload: { assigned_user_id: bulkAssignUserId },
        }),
      });
      if (!res.ok) throw new Error('Bulk assign failed');
      toast.success(`Assigned ${ids.length} contacts`);
      setSelected(new Set());
      setBulkAssignOpen(false);
      fetchContacts();
    } catch {
      toast.error('Failed to assign contacts');
    }
  };

  const handleBulkTag = async () => {
    if (!bulkTagId) {
      toast.error('Please select a tag');
      return;
    }
    const ids = [...selected];
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_tag',
          contact_ids: ids,
          payload: { tag_id: bulkTagId },
        }),
      });
      if (!res.ok) throw new Error('Bulk tagging failed');
      toast.success(`Tagged ${ids.length} contacts`);
      setSelected(new Set());
      setBulkTagOpen(false);
      fetchContacts();
    } catch {
      toast.error('Failed to tag contacts');
    }
  };

  const handleBulkRemoveTag = async () => {
    if (!bulkRemoveTagId) {
      toast.error('Please select a tag to remove');
      return;
    }
    const ids = [...selected];
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_tag',
          contact_ids: ids,
          payload: { tag_id: bulkRemoveTagId },
        }),
      });
      if (!res.ok) throw new Error('Bulk tag removal failed');
      toast.success(`Removed tag from ${ids.length} contacts`);
      setSelected(new Set());
      setBulkRemoveTagOpen(false);
      fetchContacts();
    } catch {
      toast.error('Failed to remove tag');
    }
  };

  const handleBulkMoveStage = async () => {
    if (!bulkStage) {
      toast.error('Please select a stage');
      return;
    }
    const ids = [...selected];
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_stage',
          contact_ids: ids,
          payload: { stage: bulkStage },
        }),
      });
      if (!res.ok) throw new Error('Bulk stage update failed');
      toast.success(`Moved ${ids.length} contacts to stage "${bulkStage}"`);
      setSelected(new Set());
      setBulkStageOpen(false);
      fetchContacts();
    } catch {
      toast.error('Failed to update stage');
    }
  };

  const handleBulkCreateFollowup = async () => {
    if (!bulkTaskDueDate) {
      toast.error('Please select a due date');
      return;
    }
    const ids = [...selected];
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_followup',
          contact_ids: ids,
          payload: {
            followup_type: bulkTaskTitle || 'Follow-up Task',
            due_date: bulkTaskDueDate,
            notes: bulkTaskNotes || null,
            assigned_user_id: bulkTaskUserId || null,
          },
        }),
      });
      if (!res.ok) throw new Error('Bulk task creation failed');
      toast.success(`Created follow-up tasks for ${ids.length} contacts`);
      setSelected(new Set());
      setBulkFollowupOpen(false);
      fetchContacts();
    } catch {
      toast.error('Failed to create follow-up tasks');
    }
  };

  const fetchContacts = useCallback(async () => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setLoading(true);
    setLoadError(null);
    // The visible rows are about to change — drop any selection that
    // referred to the old page/search results so the bulk bar can't
    // act on rows the user can no longer see.
    setSelected(new Set());

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/contacts?${params}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: Contact[];
        total?: number;
        error?: string;
        requestId?: string;
      } | null;
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        const message =
          payload?.error ?? `Unable to load contacts (${response.status})`;
        setLoadError(
          payload?.requestId
            ? `${message} (request ${payload.requestId})`
            : message
        );
        toast.error(message);
        return;
      }
      const rawData = payload?.data ?? [];
      const data = rawData.filter((c) => isIndividualContact(c));

      setTotalCount(payload?.total ?? data.length);

      if (!data || data.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // Enrichment must not create or mutate patient records while listing.
      const contactIds = data.map((c) => c.id);
      const patientsMap: Record<
        string,
        { patient_seq_id?: string; blood_group?: string }
      > = {};
      const tagsByContact: Record<string, string[]> = {};

      try {
        const { data: contactTags } = await appwrite
          .from('contact_tags')
          .select('contact_id, tag_id')
          .in('contact_id', contactIds);

        contactTags?.forEach((ct) => {
          if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
          tagsByContact[ct.contact_id].push(ct.tag_id);
        });
      } catch (err) {
        console.warn('[ContactsPage] Failed to fetch contact_tags:', err);
      }

      try {
        const { data: patientsList } = await appwrite
          .from('patients')
          .select('id, patient_seq_id, blood_group')
          .in('id', contactIds);

        patientsList?.forEach((p) => {
          patientsMap[p.id] = {
            patient_seq_id: p.patient_seq_id || undefined,
            blood_group: p.blood_group || undefined,
          };
        });
      } catch (err) {
        console.warn('[ContactsPage] Failed to fetch patient labels:', err);
      }

      const currentTagsMap = tagsMapRef.current;
      const enriched: ContactWithTags[] = data.map((c) => {
        const meta =
          c.metadata && typeof c.metadata === 'object' ? c.metadata : {};
        const pData = patientsMap[c.id];
        const patientIdVal = getOrGeneratePatientId(c, pData?.patient_seq_id);
        const metaObj = meta as Record<string, unknown>;
        const bloodGroupVal =
          pData?.blood_group ||
          (metaObj.blood_group as string) ||
          (metaObj['Blood Group'] as string) ||
          '—';

        return {
          ...c,
          metadata: {
            ...meta,
            patient_id: patientIdVal,
            blood_group: bloodGroupVal,
          },
          tags: (tagsByContact[c.id] ?? [])
            .map((tid) => currentTagsMap[tid])
            .filter(Boolean),
        };
      });

      setContacts(enriched);
    } catch {
      if (controller.signal.aborted) return;
      setLoadError('Unable to load contacts. Check your connection and retry.');
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [appwrite, page, router, search]);

  // Load-once-on-mount-ish data fetches. Each setter inside runs
  // inside an async promise completion (appwrite await), not
  // synchronously in the effect body, so the cascade the lint rule
  // warns about doesn't apply here.
  useEffect(() => {
    fetchTags();
    fetchProfiles();
  }, [fetchTags, fetchProfiles]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchContacts(), 250);
    return () => {
      window.clearTimeout(timer);
      requestAbortRef.current?.abort();
    };
  }, [fetchContacts]);

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await appwrite
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      // 1. Fetch conversation IDs associated with the contact
      const { data: conversations } = await appwrite
        .from('conversations')
        .select('id')
        .eq('contact_id', deleteTarget.id);

      const convIds = (conversations || []).map(
        (c) => (c as { id: string }).id
      );

      // 2. Delete related deals
      if (convIds.length > 0) {
        await appwrite.from('deals').delete().in('conversation_id', convIds);
      }

      // 3. Delete related appointments, reports, notes, patients, conversations
      await appwrite
        .from('appointments')
        .delete()
        .eq('patient_id', deleteTarget.id);
      await appwrite
        .from('hospital_lab_reports')
        .delete()
        .eq('patient_id', deleteTarget.id);
      await appwrite
        .from('contact_notes')
        .delete()
        .eq('contact_id', deleteTarget.id);
      await appwrite.from('patients').delete().eq('id', deleteTarget.id);
      await appwrite
        .from('conversations')
        .delete()
        .eq('contact_id', deleteTarget.id);

      // 4. Finally, delete the contact record
      const { error } = await appwrite
        .from('contacts')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        throw error;
      } else {
        toast.success(`${entityLabel} profile deleted successfully`);
        fetchContacts();
      }
    } catch (err: unknown) {
      console.error('[Delete Patient] Error:', err);
      toast.error(
        'Failed to delete patient profile: ' + (err as Error).message
      );
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  }

  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someOnPageSelected = contacts.some((c) => selected.has(c.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        contacts.forEach((c) => next.delete(c.id));
      } else {
        contacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);

    try {
      // 1. Fetch conversation IDs associated with the contacts
      const { data: conversations } = await appwrite
        .from('conversations')
        .select('id')
        .in('contact_id', ids);

      const convIds = (conversations || []).map(
        (c) => (c as { id: string }).id
      );

      // 2. Delete related deals
      if (convIds.length > 0) {
        await appwrite.from('deals').delete().in('conversation_id', convIds);
      }

      // 3. Delete related appointments, reports, notes, patients, conversations
      await appwrite.from('appointments').delete().in('patient_id', ids);
      await appwrite
        .from('hospital_lab_reports')
        .delete()
        .in('patient_id', ids);
      await appwrite.from('contact_notes').delete().in('contact_id', ids);
      await appwrite.from('patients').delete().in('id', ids);
      await appwrite.from('conversations').delete().in('contact_id', ids);

      // 4. Finally, delete the contacts
      const { error } = await appwrite.from('contacts').delete().in('id', ids);

      if (error) {
        throw error;
      } else {
        toast.success(`${ids.length} patient profiles deleted`);
        setSelected(new Set());
        fetchContacts();
      }
    } catch (err: unknown) {
      console.error('[Bulk Delete Patients] Error:', err);
      toast.error(
        'Failed to delete patient profiles: ' + (err as Error).message
      );
    } finally {
      setDeleting(false);
      setBulkDeleteOpen(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            {entityLabelPlural}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your {entityLabelPlural.toLowerCase()},{' '}
            {terminology.pipelineItems.toLowerCase()} and conversations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomFieldsOpen(true)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="mr-1 size-3.5" />
              Custom Fields
            </Button>
          )}
          <GatedButton
            variant="outline"
            size="sm"
            canAct={canEdit}
            gateReason={`add or import ${entityLabelPlural.toLowerCase()}`}
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="mr-1 size-3.5" />
            Import
          </GatedButton>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCsv(false)}
            className="border-border text-muted-foreground hover:bg-muted gap-1.5"
          >
            <Download className="size-3.5" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedOutboundContact(null);
              setOutboundModalOpen(true);
            }}
            className="cursor-pointer gap-1.5 border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <MessageSquare className="size-3.5" />
            Outbound
          </Button>

          <GatedButton
            size="sm"
            canAct={canEdit}
            gateReason={`add or import ${entityLabelPlural.toLowerCase()}`}
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="mr-1 size-3.5" />
            Add {entityLabel}
          </GatedButton>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Total {entityLabelPlural}
            </span>
            <Users className="text-primary size-4" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {totalCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              My {entityLabelPlural}
            </span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {myContactsCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Unassigned
            </span>
            <UserX className="size-4 text-amber-500" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {unassignedCount}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              New This Week
            </span>
            <TrendingUp className="size-4 text-blue-500" />
          </div>
          <p className="text-foreground mt-1 text-2xl font-bold">
            {newThisWeekCount}
          </p>
        </div>
      </div>

      {/* Search & Smart Filters Bar */}
      <div className="bg-card border-border space-y-3 rounded-xl border p-4 shadow-2xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={`Search ${entityLabelPlural.toLowerCase()} by name, phone, email, or company...`}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground pl-9 text-sm"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'all' | 'leads' | 'customers' | 'inactive'
                )
              }
              className="bg-background border-border text-foreground focus:ring-primary h-9 rounded-md border px-2.5 text-xs focus:ring-1 focus:outline-none"
              aria-label="Filter by Status"
            >
              <option value="all">Status: All</option>
              <option value="leads">{terminology.pipelineItems} Only</option>
              <option value="customers">{terminology.primaryRecords}</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Assignment Filter */}
            <select
              value={assignmentFilter}
              onChange={(e) =>
                setAssignmentFilter(
                  e.target.value as 'everyone' | 'me' | 'unassigned'
                )
              }
              className="bg-background border-border text-foreground focus:ring-primary h-9 rounded-md border px-2.5 text-xs focus:ring-1 focus:outline-none"
              aria-label="Filter by Assignment"
            >
              <option value="everyone">All Teammates</option>
              <option value="me">Assigned to Me</option>
              <option value="unassigned">Unassigned</option>
            </select>

            {/* Lead Temperature */}
            <select
              value={tempFilter}
              onChange={(e) =>
                setTempFilter(e.target.value as 'all' | 'hot' | 'warm' | 'cold')
              }
              className="bg-background border-border text-foreground focus:ring-primary h-9 rounded-md border px-2.5 text-xs focus:ring-1 focus:outline-none"
              aria-label={`Filter by ${terminology.pipelineItem} score`}
            >
              <option value="all">Score: All</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">🟡 Warm</option>
              <option value="cold">🔵 Cold</option>
            </select>

            {/* WhatsApp */}
            <select
              value={whatsappFilter}
              onChange={(e) =>
                setWhatsappFilter(
                  e.target.value as 'all' | 'connected' | 'no_whatsapp'
                )
              }
              className="bg-background border-border text-foreground focus:ring-primary h-9 rounded-md border px-2.5 text-xs focus:ring-1 focus:outline-none"
              aria-label="Filter by WhatsApp"
            >
              <option value="all">WhatsApp: All</option>
              <option value="connected">Connected</option>
              <option value="no_whatsapp">No WhatsApp</option>
            </select>

            {/* Activity */}
            <select
              value={activityFilter}
              onChange={(e) =>
                setActivityFilter(
                  e.target.value as 'all' | 'recent' | 'inactive'
                )
              }
              className="bg-background border-border text-foreground focus:ring-primary h-9 rounded-md border px-2.5 text-xs focus:ring-1 focus:outline-none"
              aria-label="Filter by Activity"
            >
              <option value="all">Activity: All</option>
              <option value="recent">Recently Active</option>
              <option value="inactive">No Recent Activity</option>
            </select>
          </div>
        </div>

        {/* Saved Filters Presets */}
        <SavedFilterBar
          entityType="contacts"
          currentFilters={{
            search,
            status: statusFilter,
            assignment: assignmentFilter,
            temperature: tempFilter,
          }}
          activeFilterId={activeFilterId}
          onSelectFilter={(filterId, filters) => {
            setActiveFilterId(filterId);
            if (filters) {
              if (typeof filters.search === 'string') setSearch(filters.search);
              if (typeof filters.status === 'string')
                setStatusFilter(
                  filters.status as 'all' | 'leads' | 'customers' | 'inactive'
                );
              if (typeof filters.assignment === 'string')
                setAssignmentFilter(
                  filters.assignment as 'everyone' | 'me' | 'unassigned'
                );
              if (typeof filters.temperature === 'string')
                setTempFilter(
                  filters.temperature as 'all' | 'hot' | 'warm' | 'cold'
                );
            } else if (filterId === null) {
              setSearch('');
              setStatusFilter('all');
              setAssignmentFilter('everyone');
              setTempFilter('all');
            }
            setPage(0);
          }}
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2">
          <p className="text-foreground text-sm">
            <span className="font-medium">{selected.size}</span>{' '}
            {selected.size === 1 ? 'contact' : 'contacts'} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAssignOpen(true)}
              className="gap-1 text-xs"
            >
              <UserCheck className="text-primary size-3.5" />
              Assign
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkTagOpen(true)}
              className="gap-1 text-xs"
            >
              <TagIcon className="text-primary size-3.5" />
              Add Tag
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkRemoveTagOpen(true)}
              className="gap-1 text-xs"
            >
              <TagIcon className="size-3.5 text-amber-500" />
              Remove Tag
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkStageOpen(true)}
              className="gap-1 text-xs"
            >
              <TrendingUp className="size-3.5 text-blue-500" />
              Move Stage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkFollowupOpen(true)}
              className="gap-1 text-xs"
            >
              <Clock className="size-3.5 text-indigo-500" />
              Create Follow-up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv(true)}
              className="gap-1 text-xs"
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </Button>
            <GatedButton
              variant="destructive"
              size="sm"
              canAct={canEdit}
              gateReason="delete contacts"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </GatedButton>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="border-border hidden overflow-hidden rounded-lg border sm:block">
        {loadError && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 border-b px-4 py-3 text-sm"
          >
            <span>{loadError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchContacts()}
            >
              Retry
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={filteredContacts.length === 0}
                  aria-label={`Select all ${entityLabelPlural.toLowerCase()} on this page`}
                />
              </TableHead>
              <TableHead className="text-muted-foreground">
                {entityLabel}
              </TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">
                {terminology.pipelineItem} Score
              </TableHead>
              <TableHead className="text-muted-foreground">
                Assigned To
              </TableHead>
              <TableHead className="text-muted-foreground">
                Last Activity
              </TableHead>
              <TableHead className="text-muted-foreground">
                Next Follow-up
              </TableHead>
              <TableHead className="text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="text-primary size-6 animate-spin" />
                    <p className="text-muted-foreground text-sm">
                      Loading {entityLabelPlural.toLowerCase()}...
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="py-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    {entityLabelPlural} could not be loaded. Use Retry to try
                    again.
                  </p>
                </TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                    <Users className="text-muted-foreground size-8 text-emerald-500/60" />
                    <p className="text-foreground text-sm font-semibold">
                      {search ||
                      statusFilter !== 'all' ||
                      assignmentFilter !== 'everyone'
                        ? `No ${entityLabelPlural.toLowerCase()} match your filters.`
                        : `Your ${entityLabelPlural.toLowerCase()} will appear here automatically.`}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {search || statusFilter !== 'all'
                        ? 'Try adjusting your search or active filter pills.'
                        : `Every person who messages your WhatsApp can be saved with their conversation history.`}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => {
                const meta = (contact.metadata || {}) as Record<
                  string,
                  unknown
                >;
                const stage = String(meta.stage || '').toUpperCase();
                const isLead =
                  stage.length > 0 ||
                  String(contact.entity_type || '').includes('lead');
                const assignedPerson = contact.assigned_user_id
                  ? profileMap[contact.assigned_user_id]
                  : null;
                const assignedName =
                  assignedPerson?.full_name ||
                  (meta.assigned_user_name as string) ||
                  'Unassigned';
                const nextFollowup =
                  (meta.next_followup as string) ||
                  (meta.next_appointment as string) ||
                  '—';
                const lastActivity = contact.updated_at || contact.created_at;

                return (
                  <TableRow
                    key={contact.id}
                    className="border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => openDetail(contact.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                        aria-label={`Select ${contact.name || contact.phone}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {contact.name ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(contact.id);
                            }}
                            className="text-foreground cursor-pointer text-left text-sm font-semibold hover:underline"
                          >
                            {whatsappContactDisplayName(
                              contact.name,
                              contact.phone
                            ) || contact.name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm font-normal italic">
                            Unnamed
                          </span>
                        )}
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span className="font-mono">
                            {formatWhatsAppDisplayPhone(contact.phone) ||
                              contact.phone}
                          </span>
                          {contact.email && (
                            <span className="max-w-[120px] truncate">
                              {contact.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isLead
                            ? 'border-blue-500/30 bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {isLead ? 'Lead' : 'Customer'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {renderLeadScoreBadge(meta.ai_lead_score || meta.score)}
                    </TableCell>
                    <TableCell>
                      {contact.assigned_user_id ? (
                        <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                          <UserCheck className="size-3.5 text-emerald-500" />
                          {assignedName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatRelativeTime(lastActivity)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {nextFollowup}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetail(contact.id)}
                          className="h-7 px-2.5 text-xs font-semibold"
                        >
                          <Eye className="mr-1 size-3" />
                          View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-foreground h-7 w-7"
                              />
                            }
                          >
                            <MoreHorizontal className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-popover border-border"
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOutboundContact(contact);
                                setOutboundModalOpen(true);
                              }}
                              className="focus:bg-muted font-medium text-emerald-600 focus:text-emerald-500 dark:text-emerald-400"
                            >
                              <MessageSquare className="size-4" />
                              Send Outbound WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openEditForm(contact)}
                              className="text-popover-foreground focus:bg-muted focus:text-foreground"
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => confirmDelete(contact)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Responsive Cards Layout */}
      <div className="flex flex-col gap-3 sm:hidden">
        {loading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            <Loader2 className="text-primary mx-auto size-6 animate-spin" />
            <p className="mt-2">Loading {entityLabelPlural.toLowerCase()}...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="border-border text-muted-foreground bg-card rounded-xl border p-6 text-center text-sm">
            No {entityLabelPlural.toLowerCase()} match your filters.
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const meta = (contact.metadata || {}) as Record<string, unknown>;
            const assignedPerson = contact.assigned_user_id
              ? profileMap[contact.assigned_user_id]
              : null;
            const assignedName =
              assignedPerson?.full_name ||
              (meta.assigned_user_name as string) ||
              'Unassigned';
            const nextFollowup =
              (meta.next_followup as string) ||
              (meta.next_appointment as string) ||
              '—';
            const lastActivity = contact.updated_at || contact.created_at;

            return (
              <div
                key={contact.id}
                onClick={() => openDetail(contact.id)}
                className="bg-card border-border hover:border-primary/50 cursor-pointer space-y-2.5 rounded-xl border p-3.5 shadow-2xs transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {contact.name ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(contact.id);
                        }}
                        className="text-foreground cursor-pointer text-left text-sm font-bold hover:underline"
                      >
                        {whatsappContactDisplayName(
                          contact.name,
                          contact.phone
                        ) || contact.name}
                      </button>
                    ) : (
                      <h3 className="text-foreground text-sm font-bold">
                        Unnamed
                      </h3>
                    )}
                    <p className="text-muted-foreground font-mono text-xs">
                      {formatWhatsAppDisplayPhone(contact.phone) ||
                        contact.phone}
                    </p>
                  </div>
                  {renderLeadScoreBadge(meta.ai_lead_score || meta.score)}
                </div>

                <div className="border-border/50 text-muted-foreground grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground/70 block text-[10px] font-bold uppercase">
                      Assigned To
                    </span>
                    <span className="text-foreground font-medium">
                      {assignedName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70 block text-[10px] font-bold uppercase">
                      Last Activity
                    </span>
                    <span className="text-foreground font-medium">
                      {formatRelativeTime(lastActivity)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70 block text-[10px] font-bold uppercase">
                      Next Follow-up
                    </span>
                    <span className="text-foreground font-medium">
                      {nextFollowup}
                    </span>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(contact.id);
                      }}
                      className="border-primary/30 text-primary h-7 px-2.5 text-xs font-semibold"
                    >
                      <Eye className="mr-1 size-3" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            Showing {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-muted-foreground px-2 text-xs">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchContacts();
          fetchTags();
        }}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={fetchContacts}
      />

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchContacts}
      />

      {/* Outbound WhatsApp Message Modal */}
      <SendOutboundModal
        open={outboundModalOpen}
        onOpenChange={setOutboundModalOpen}
        defaultContact={selectedOutboundContact}
        onSuccess={fetchContacts}
      />

      {/* Custom Fields Manager (admin+) */}
      {canEditSettings && (
        <CustomFieldsManager
          open={customFieldsOpen}
          onOpenChange={setCustomFieldsOpen}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Delete {entityLabel}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete{' '}
              <span className="text-popover-foreground font-medium">
                {deleteTarget?.name || deleteTarget?.phone}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Delete {selected.size}{' '}
              {selected.size === 1 ? entityLabel : entityLabelPlural}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete{' '}
              <span className="text-popover-foreground font-medium">
                {selected.size} {selected.size === 1 ? 'contact' : 'contacts'}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Assign {selected.size}{' '}
              {selected.size === 1 ? entityLabel : entityLabelPlural}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select a team member to assign the selected contacts to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <select
              value={bulkAssignUserId}
              onChange={(e) => setBulkAssignUserId(e.target.value)}
              className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-xs focus:ring-1"
            >
              <option value="">Select Team Member...</option>
              {allProfiles.map((p) => (
                <option key={p.id || p.user_id} value={p.id || p.user_id}>
                  {p.full_name || p.email} ({p.role || 'Member'})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkAssignOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignUserId}>
              Assign {entityLabelPlural}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Tag Dialog */}
      <Dialog open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Add Tag to {selected.size}{' '}
              {selected.size === 1 ? entityLabel : entityLabelPlural}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose a tag to apply to all selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <select
              value={bulkTagId}
              onChange={(e) => setBulkTagId(e.target.value)}
              className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-xs focus:ring-1"
            >
              <option value="">Select a tag...</option>
              {allAvailableTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkTagOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button onClick={handleBulkTag} disabled={!bulkTagId}>
              Apply Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Remove Tag Dialog */}
      <Dialog open={bulkRemoveTagOpen} onOpenChange={setBulkRemoveTagOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Remove Tag from {selected.size}{' '}
              {selected.size === 1 ? entityLabel : entityLabelPlural}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose a tag to remove from all selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <select
              value={bulkRemoveTagId}
              onChange={(e) => setBulkRemoveTagId(e.target.value)}
              className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-xs focus:ring-1"
            >
              <option value="">Select a tag to remove...</option>
              {allAvailableTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkRemoveTagOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button onClick={handleBulkRemoveTag} disabled={!bulkRemoveTagId}>
              Remove Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Stage Dialog */}
      <Dialog open={bulkStageOpen} onOpenChange={setBulkStageOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Move {selected.size}{' '}
              {selected.size === 1 ? entityLabel : entityLabelPlural} to Stage
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select the pipeline stage to apply to the selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <select
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value)}
              className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-xs focus:ring-1"
            >
              <option value="NEW">New {terminology.pipelineItem}</option>
              <option value="QUALIFYING">Qualifying</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="BOOKED">Booked</option>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkStageOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button onClick={handleBulkMoveStage} disabled={!bulkStage}>
              Update Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Follow-up Dialog */}
      <Dialog open={bulkFollowupOpen} onOpenChange={setBulkFollowupOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              Create Follow-up for {selected.size}{' '}
              {selected.size === 1 ? entityLabel : entityLabelPlural}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Schedule a task or reminder for all selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Task / Follow-up Title
              </label>
              <Input
                value={bulkTaskTitle}
                onChange={(e) => setBulkTaskTitle(e.target.value)}
                placeholder="e.g. Follow-up Call, Review, Payment Reminder"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Due Date
              </label>
              <Input
                type="date"
                value={bulkTaskDueDate}
                onChange={(e) => setBulkTaskDueDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Assign to Teammate (Optional)
              </label>
              <select
                value={bulkTaskUserId}
                onChange={(e) => setBulkTaskUserId(e.target.value)}
                className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-xs focus:ring-1"
              >
                <option value="">Unassigned</option>
                {allProfiles.map((p) => (
                  <option key={p.id || p.user_id} value={p.id || p.user_id}>
                    {p.full_name || p.email} ({p.role || 'Member'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Notes (Optional)
              </label>
              <Input
                value={bulkTaskNotes}
                onChange={(e) => setBulkTaskNotes(e.target.value)}
                placeholder="Additional instructions..."
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkFollowupOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkCreateFollowup}
              disabled={!bulkTaskDueDate}
            >
              Schedule Follow-ups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
