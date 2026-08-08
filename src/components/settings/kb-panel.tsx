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
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
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

const CATEGORY_MAP: Record<
  KbEntry['category'],
  { label: string; icon: React.ElementType; color: string }
> = {
  faq: {
    label: 'FAQ',
    icon: HelpCircle,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  service: {
    label: 'Services',
    icon: Briefcase,
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  pricing: {
    label: 'Fees & Charges',
    icon: DollarSign,
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  policy: {
    label: 'Hospital Policies',
    icon: ShieldAlert,
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  company: {
    label: 'Hospital Profile',
    icon: FileText,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
};

export function KbPanel() {
  const { canSendMessages } = useAuth(); // Agents and above can manage Knowledge Base
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KbEntry | null>(null);

  // Form State
  const [category, setCategory] = useState<KbEntry['category']>('faq');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadEntries() {
    try {
      const response = await fetch('/api/account/kb');
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      } else {
        toast.error('Failed to load Knowledge Base entries');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error loading Knowledge Base');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function handleOpenAddDialog() {
    setEditingEntry(null);
    setCategory('faq');
    setTitle('');
    setContent('');
    setDialogOpen(true);
  }

  function handleOpenEditDialog(entry: KbEntry) {
    setEditingEntry(entry);
    setCategory(entry.category);
    setTitle(entry.question_title);
    setContent(entry.answer_content);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Title and Content are required');
      return;
    }

    setSubmitting(true);
    try {
      const url = '/api/account/kb';
      const method = editingEntry ? 'PATCH' : 'POST';
      const body = {
        category,
        question_title: title.trim(),
        answer_content: content.trim(),
        ...(editingEntry ? { id: editingEntry.id } : {}),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(
          editingEntry
            ? 'Knowledge Base entry updated successfully'
            : 'Knowledge Base entry created successfully'
        );
        setDialogOpen(false);
        loadEntries();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving Knowledge Base entry');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Are you sure you want to delete this entry? This action cannot be undone.'
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
        <SettingsPanelHead
          title="Hospital Information"
          description="Manage FAQs, clinical services, consultation fees, and hospital policies that the AI uses to reply to patient inquiries."
        />
        <Card className="flex h-64 items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </Card>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 max-w-4xl duration-200">
      <div className="flex items-center justify-between">
        <SettingsPanelHead
          title="Hospital Information"
          description="Build a repository of verified knowledge about your clinic/hospital. The AI Reply Engine will search this context to answer patient questions accurately."
        />
        {canSendMessages && (
          <Button
            onClick={handleOpenAddDialog}
            className="flex shrink-0 items-center gap-1.5"
          >
            <Plus className="size-4" />
            Add Info
          </Button>
        )}
      </div>

      {/* Tabs Filter */}
      <div className="border-border mb-6 flex gap-2 overflow-x-auto border-b">
        {['all', 'faq', 'service', 'pricing', 'policy', 'company'].map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {tab === 'all'
                ? 'All Categories'
                : CATEGORY_MAP[tab as KbEntry['category']].label}
            </button>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Database className="text-primary size-4" />
            Hospital Info Context ({filteredEntries.length})
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Keep your knowledge context concise and factual. The AI works best
            when given explicit Q&A formats or structured guides.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="border-border rounded-lg border border-dashed py-12 text-center">
              <Database className="text-muted-foreground mx-auto mb-2 size-8 opacity-50" />
              <p className="text-muted-foreground text-sm">
                No entries found in this category.
              </p>
              {canSendMessages && (
                <Button
                  variant="link"
                  onClick={handleOpenAddDialog}
                  className="text-primary mt-2"
                >
                  Create your first entry
                </Button>
              )}
            </div>
          ) : (
            <div className="border-border overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[120px]">Category</TableHead>
                    <TableHead className="w-[260px]">
                      Title / Question
                    </TableHead>
                    <TableHead>Content / Answer</TableHead>
                    {canSendMessages && (
                      <TableHead className="w-[100px] text-right">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const catMeta = CATEGORY_MAP[entry.category];
                    const CatIcon = catMeta.icon;
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${catMeta.color} flex w-fit items-center gap-1`}
                          >
                            <CatIcon className="size-3" />
                            {catMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground align-top font-semibold">
                          {entry.question_title}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-sm truncate text-sm whitespace-pre-wrap lg:max-w-none">
                          {entry.answer_content}
                        </TableCell>
                        {canSendMessages && (
                          <TableCell className="text-right align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={() => handleOpenEditDialog(entry)}
                              >
                                <Edit className="text-muted-foreground hover:text-foreground size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 className="size-3.5 text-red-500 hover:text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
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
        <DialogContent className="bg-popover text-popover-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Edit Knowledge Entry' : 'Add Knowledge Entry'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define a factual topic or FAQ. Be descriptive and accurate.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as KbEntry['category'])}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="service">Service Details</SelectItem>
                  <SelectItem value="pricing">Pricing & Cost</SelectItem>
                  <SelectItem value="policy">Terms & Policies</SelectItem>
                  <SelectItem value="company">Company Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title or Question</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., What are our delivery charges?"
                className="bg-background text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">Content or Answer</Label>
              <Textarea
                id="content"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g., We offer free shipping on all orders above ₹999. For orders below that, we charge a flat fee of ₹50."
                className="bg-background text-foreground whitespace-pre-wrap"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                {editingEntry ? 'Save Changes' : 'Create Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
