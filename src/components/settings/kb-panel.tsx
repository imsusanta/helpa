'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Database,
  Plus,
  Trash2,
  Edit,
  Loader2,
  FileText,
  DollarSign,
  Briefcase,
  HelpCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getIndustryModule } from '@/modules/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SettingsPanelHead } from './settings-panel-head';

interface KbEntry {
  id: string;
  category: 'faq' | 'service' | 'pricing' | 'policy' | 'company';
  question_title: string;
  answer_content: string;
  created_at: string;
  updated_at: string;
}

function getCategoryMap(industryId?: string) {
  const isHospital = industryId === 'hospital_clinic';
  const isTravel = industryId === 'travel';
  const isCoaching = industryId === 'coaching' || industryId === 'solo_teacher';
  const isRealEstate = industryId === 'real_estate';

  return {
    faq: {
      label: 'Common Questions (FAQs)',
      shortLabel: 'FAQs',
      icon: HelpCircle,
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      description: 'Frequently asked customer questions and standard answers.',
      emptyMessage:
        'No common questions added yet. Add the questions your customers ask most often so your AI can answer them instantly.',
      cta: 'Add Question',
    },
    service: {
      label: isHospital
        ? 'Doctor Consultations & Services'
        : isTravel
          ? 'Tour Packages & Services'
          : isCoaching
            ? 'Courses & Batches'
            : isRealEstate
              ? 'Properties & Units'
              : 'Services & Products',
      shortLabel: 'Services',
      icon: Briefcase,
      color: 'bg-green-500/10 text-green-400 border-green-500/20',
      description: 'Descriptions of what you offer to clients and customers.',
      emptyMessage:
        'No services added yet. Add your services and offerings so your AI can explain them to customers.',
      cta: 'Add Service',
    },
    pricing: {
      label: isHospital
        ? 'Consultation Fees & Rate Card'
        : isTravel
          ? 'Tour Package Prices'
          : isCoaching
            ? 'Tuition & Batch Fees'
            : 'Pricing & Rates',
      shortLabel: 'Pricing',
      icon: DollarSign,
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      description: 'Official fees and rates in ₹ for your services.',
      emptyMessage:
        'No pricing rates added yet. Add your fees and rates so your AI receptionist can provide instant quotes.',
      cta: 'Add Pricing',
    },
    policy: {
      label: isHospital
        ? 'Clinic Policies & Appointments'
        : isTravel
          ? 'Cancellation & Booking Terms'
          : isCoaching
            ? 'Admission & Batch Rules'
            : 'Policies & Booking Terms',
      shortLabel: 'Policies',
      icon: ShieldAlert,
      color: 'bg-red-500/10 text-red-400 border-red-500/20',
      description: 'Appointment rules, refund policies, and payment terms.',
      emptyMessage:
        'No policies added yet. Add your appointment guidelines or payment terms for customers.',
      cta: 'Add Policy',
    },
    company: {
      label: isHospital
        ? 'Clinic & Practice Information'
        : isTravel
          ? 'Agency Information'
          : isCoaching
            ? 'Institute Information'
            : 'Business Information',
      shortLabel: 'Business Info',
      icon: FileText,
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      description: 'General information, address, location, and background.',
      emptyMessage:
        'Complete your business information so Helpa can give customers accurate location and contact details.',
      cta: 'Complete Business Info',
    },
  };
}

export function KbPanel() {
  const { canSendMessages, account } = useAuth();
  const activeModule = getIndustryModule(account?.industry);
  const categoryMap = getCategoryMap(activeModule.id);

  const panelTitle = 'Business Info & FAQs';
  const panelDesc =
    'Give your AI receptionist the exact answers, services, pricing, and business policies needed to answer customer inquiries 24/7.';

  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KbEntry | null>(null);

  // Form State
  const [category, setCategory] = useState<KbEntry['category']>('service');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadEntries() {
    try {
      const response = await fetch('/api/account/kb');
      if (response.ok) {
        const data = await response.json();
        setEntries(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : []
        );
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.error(err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function handleOpenAddDialog(defaultCat?: KbEntry['category']) {
    setEditingEntry(null);
    setCategory(
      defaultCat ||
        (activeTab !== 'all' ? (activeTab as KbEntry['category']) : 'service')
    );
    setTitle('');
    setContent('');
    setDialogOpen(true);
  }

  function handleEdit(entry: KbEntry) {
    setEditingEntry(entry);
    setCategory(entry.category);
    setTitle(entry.question_title);
    setContent(entry.answer_content);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in both the title and content');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category,
        question_title: title.trim(),
        answer_content: content.trim(),
      };

      const url = editingEntry
        ? `/api/account/kb?id=${editingEntry.id}`
        : '/api/account/kb';
      const method = editingEntry ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const catName = categoryMap[category]?.shortLabel || 'Entry';
        toast.success(
          editingEntry
            ? `${catName} updated successfully`
            : `${catName} added successfully`
        );
        setDialogOpen(false);
        loadEntries();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save information');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving business information');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Are you sure you want to delete this entry? Your AI will no longer use it to answer questions.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/account/kb?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Entry deleted successfully');
        loadEntries();
      } else {
        toast.error('Failed to delete entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting entry');
    }
  }

  const filteredEntries =
    activeTab === 'all'
      ? entries
      : entries.filter((e) => e.category === activeTab);

  if (loading) {
    return (
      <section className="animate-in fade-in-50 max-w-4xl duration-200">
        <SettingsPanelHead title={panelTitle} description={panelDesc} />
        <Card className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin text-emerald-500" />
        </Card>
      </section>
    );
  }

  const activeCategoryMeta =
    activeTab !== 'all' ? categoryMap[activeTab as KbEntry['category']] : null;

  return (
    <section className="animate-in fade-in-50 max-w-4xl space-y-6 duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SettingsPanelHead title={panelTitle} description={panelDesc} />
        {canSendMessages && (
          <Button
            onClick={() => handleOpenAddDialog()}
            className="flex shrink-0 items-center gap-1.5 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            Add Service or FAQ
          </Button>
        )}
      </div>

      {/* Structured Category Tabs */}
      <div className="border-border flex gap-2 overflow-x-auto border-b pb-0.5">
        <button
          onClick={() => setActiveTab('all')}
          className={`border-b-2 px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'all'
              ? 'border-emerald-500 text-emerald-400'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          All Items ({entries.length})
        </button>
        {(['service', 'pricing', 'faq', 'company', 'policy'] as const).map(
          (tab) => {
            const count = entries.filter((e) => e.category === tab).length;
            const meta = categoryMap[tab];
            const Icon = meta.icon;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-emerald-500 text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                }`}
              >
                <Icon className="size-3.5" />
                {meta.shortLabel} ({count})
              </button>
            );
          }
        )}
      </div>

      {/* Main Content List Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Sparkles className="size-4 text-emerald-500" />
              {activeCategoryMeta
                ? activeCategoryMeta.label
                : 'All Business Knowledge & FAQs'}{' '}
              ({filteredEntries.length})
            </CardTitle>
            <Badge
              variant="outline"
              className="border-emerald-500/20 text-[10px] text-emerald-400"
            >
              Synced with AI
            </Badge>
          </div>
          <CardDescription className="text-muted-foreground text-xs">
            {activeCategoryMeta
              ? activeCategoryMeta.description
              : 'Your AI receptionist references all entries below to answer customer questions accurately.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="border-border bg-muted/10 rounded-xl border border-dashed p-6 py-12 text-center">
              <Database className="text-muted-foreground mx-auto mb-2 size-8 text-emerald-500 opacity-40" />
              <p className="text-foreground text-sm font-semibold">
                {activeCategoryMeta
                  ? activeCategoryMeta.emptyMessage
                  : 'No business entries added yet.'}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs">
                Add your consultation fees, operating details, or frequent
                questions so your AI receptionist is fully equipped.
              </p>
              {canSendMessages && (
                <Button
                  onClick={() => handleOpenAddDialog()}
                  className="mt-4 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  {activeCategoryMeta
                    ? activeCategoryMeta.cta
                    : 'Add First Entry'}
                </Button>
              )}
            </div>
          ) : (
            <div className="border-border overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[130px] text-xs">
                      Category
                    </TableHead>
                    <TableHead className="w-[240px] text-xs">
                      Service / Question
                    </TableHead>
                    <TableHead className="text-xs">Details & Rates</TableHead>
                    <TableHead className="w-[100px] text-right text-xs">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const meta = categoryMap[entry.category] || categoryMap.faq;
                    const Icon = meta.icon;
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={`flex w-fit items-center gap-1 text-[10px] font-semibold ${meta.color}`}
                          >
                            <Icon className="size-3" />
                            {meta.shortLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground py-3 text-xs font-semibold">
                          {entry.question_title}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md py-3 text-xs">
                          <p className="line-clamp-2 leading-relaxed whitespace-pre-wrap">
                            {entry.answer_content}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canSendMessages && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(entry)}
                                  className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                                  title="Edit entry"
                                >
                                  <Edit className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(entry.id)}
                                  className="text-muted-foreground h-7 w-7 p-0 hover:text-red-400"
                                  title="Delete entry"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingEntry
                ? 'Edit Business Info / FAQ'
                : 'Add New Service or FAQ'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Add factual information, service rate cards, fees, or FAQs so your
              AI receptionist can answer customers accurately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="category" className="text-xs font-semibold">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as KbEntry['category'])}
              >
                <SelectTrigger
                  id="category"
                  className="bg-muted/40 border-border w-full text-xs"
                >
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border text-xs">
                  <SelectItem value="service">
                    {categoryMap.service.label}
                  </SelectItem>
                  <SelectItem value="pricing">
                    {categoryMap.pricing.label}
                  </SelectItem>
                  <SelectItem value="faq">{categoryMap.faq.label}</SelectItem>
                  <SelectItem value="company">
                    {categoryMap.company.label}
                  </SelectItem>
                  <SelectItem value="policy">
                    {categoryMap.policy.label}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title" className="text-xs font-semibold">
                {category === 'faq'
                  ? 'Question'
                  : category === 'service' || category === 'pricing'
                    ? 'Service or Package Name'
                    : 'Topic Title'}
              </Label>
              <Input
                id="title"
                placeholder={
                  category === 'faq'
                    ? 'e.g. Do I need an appointment before visiting?'
                    : category === 'service'
                      ? 'e.g. Doctor Consultation'
                      : category === 'pricing'
                        ? 'e.g. General OPD Fee'
                        : 'e.g. Clinic Location & Parking'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                className="bg-muted/40 border-border text-foreground text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content" className="text-xs font-semibold">
                {category === 'faq'
                  ? 'Answer'
                  : category === 'pricing'
                    ? 'Price & Details (e.g. ₹500 for 30-min consultation)'
                    : 'Details & Description'}
              </Label>
              <Textarea
                id="content"
                rows={5}
                placeholder={
                  category === 'faq'
                    ? 'e.g. Yes, appointments are recommended to avoid waiting. Walk-ins are also accepted based on doctor availability.'
                    : category === 'pricing'
                      ? 'e.g. ₹500 per visit. Includes general checkup and vital checks.'
                      : 'e.g. Comprehensive healthcare consultation with experienced specialist doctors.'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={submitting}
                className="bg-muted/40 border-border text-foreground text-xs leading-relaxed"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim()}
                className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : editingEntry ? (
                  'Update Entry'
                ) : (
                  'Save Entry'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
