'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  required?: boolean;
}

interface EntityConfig {
  tableName: string;
  label: string;
  pluralLabel: string;
  fields: FieldConfig[];
}

const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  students: {
    tableName: 'coaching_students',
    label: 'Student',
    pluralLabel: 'Students',
    fields: [
      { key: 'student_seq_id', label: 'Student ID (e.g. STU-1001)', type: 'text', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'parent_name', label: 'Parent / Guardian Name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'suspended'], required: true },
    ]
  },
  courses: {
    tableName: 'coaching_courses',
    label: 'Course',
    pluralLabel: 'Courses',
    fields: [
      { key: 'name', label: 'Course Name', type: 'text', required: true },
      { key: 'fee', label: 'Course Fee (in ₹)', type: 'number', required: true },
      { key: 'duration', label: 'Duration (e.g. 6 Months)', type: 'text' },
    ]
  },
  teachers: {
    tableName: 'realestate_agents', // Fallback teachers to agents table schema
    label: 'Teacher',
    pluralLabel: 'Teachers',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], required: true },
    ]
  },
  admissions: {
    tableName: 'coaching_admissions',
    label: 'Admission Record',
    pluralLabel: 'Admission Records',
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: ['pending', 'active', 'completed', 'cancelled'], required: true },
      { key: 'paid_amount', label: 'Paid Amount (in ₹)', type: 'number' },
    ]
  },
  leads: {
    tableName: 'realestate_leads',
    label: 'Lead',
    pluralLabel: 'Leads',
    fields: [
      { key: 'lead_seq_id', label: 'Lead ID (e.g. RLD-1001)', type: 'text', required: true },
      { key: 'budget', label: 'Budget Range (in ₹)', type: 'number' },
      { key: 'preferred_location', label: 'Preferred Location', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['new', 'contacted', 'viewing', 'offer', 'closed'], required: true },
    ]
  },
  properties: {
    tableName: 'realestate_properties',
    label: 'Property',
    pluralLabel: 'Properties',
    fields: [
      { key: 'name', label: 'Property Title', type: 'text', required: true },
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'price', label: 'Price (in ₹)', type: 'number', required: true },
      { key: 'type', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Penthouse', 'Commercial Plot'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['available', 'sold', 'rented'], required: true },
    ]
  },
  agents: {
    tableName: 'realestate_agents',
    label: 'Agent',
    pluralLabel: 'Agents',
    fields: [
      { key: 'name', label: 'Agent Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone Number', type: 'text' },
      { key: 'email', label: 'Email Address', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], required: true },
    ]
  },
  'site-visits': {
    tableName: 'realestate_visits',
    label: 'Site Visit',
    pluralLabel: 'Site Visits',
    fields: [
      { key: 'visit_date', label: 'Visit Date', type: 'date', required: true },
      { key: 'feedback', label: 'Feedback / Notes', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'completed', 'cancelled'], required: true },
    ]
  }
};

export function EntityPage({ entityKey }: { entityKey: string }) {
  const { accountId } = useAuth();
  const db = createClient();

  const config = ENTITY_CONFIGS[entityKey];
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!config) return;
    // Prefill default select values
    const defaults: Record<string, any> = {};
    config.fields.forEach(f => {
      if (f.type === 'select' && f.options) {
        defaults[f.key] = f.options[0];
      } else if (f.type === 'number') {
        defaults[f.key] = 0;
      } else {
        defaults[f.key] = '';
      }
    });
    setFormData(defaults);
  }, [entityKey]);

  const loadRecords = async () => {
    if (!accountId || !config) return;
    setLoading(true);
    try {
      const { data, error } = await db
        .from(config.tableName)
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err: any) {
      toast.error(`Failed to fetch records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [accountId, entityKey]);

  if (!config) {
    return <div className="p-6 text-red-500 font-bold">Invalid Entity Key</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    setSaving(true);
    try {
      const dataToInsert: any = {
        ...formData,
        account_id: accountId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Special case: if table extends contacts table (like students and leads), we need to create a dummy contact or bind it.
      // For simplicity, if they aren't bound to contacts directly, we generate a random contact uuid or insert directly.
      if (config.tableName === 'coaching_students' || config.tableName === 'realestate_leads') {
        // Create a parent contact first
        const { data: newContact, error: contactErr } = await db
          .from('contacts')
          .insert({
            account_id: accountId,
            name: formData.parent_name || formData.lead_seq_id,
            phone: '+9100000000',
          })
          .select('id')
          .single();

        if (contactErr) throw contactErr;
        dataToInsert.id = newContact.id;
      }

      const { error } = await db
        .from(config.tableName)
        .insert(dataToInsert);

      if (error) throw error;

      toast.success(`${config.label} created successfully!`);
      setIsOpen(false);
      
      // Reset form
      const defaults: Record<string, any> = {};
      config.fields.forEach(f => {
        defaults[f.key] = f.type === 'select' && f.options ? f.options[0] : '';
      });
      setFormData(defaults);
      
      loadRecords();
    } catch (err: any) {
      toast.error(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const { error } = await db
        .from(config.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Record deleted.');
      loadRecords();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const filteredRecords = records.filter(rec => {
    const valuesStr = Object.values(rec).join(' ').toLowerCase();
    return valuesStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {config.pluralLabel}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your {config.pluralLabel.toLowerCase()} templates.
          </p>
        </div>
        <Button onClick={() => setIsOpen(!isOpen)} className="cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-1.5 rounded-full px-5">
          <Plus className="h-4 w-4" /> Add {config.label}
        </Button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="border border-border rounded-xl bg-card p-6 space-y-4 max-w-xl animate-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground text-sm border-b border-border pb-2">
            New {config.label} details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-muted-foreground font-semibold text-xs">{field.label}</Label>
                {field.type === 'select' ? (
                  <select
                    id={field.key}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none"
                  >
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData({ ...formData, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="cursor-pointer rounded-full px-5">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="cursor-pointer rounded-full px-6 font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save {config.label}
            </Button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 max-w-md bg-card border border-border rounded-full px-3.5 py-1.5 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={`Search ${config.pluralLabel.toLowerCase()}...`}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground focus:outline-none border-none outline-none"
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                {config.fields.map(col => (
                  <th key={col.key} className="p-4">{col.label}</th>
                ))}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                  {config.fields.map(col => (
                    <td key={col.key} className="p-4 font-medium text-foreground">
                      {col.type === 'number' && col.key.includes('fee') ? `₹${rec[col.key] || 0}` : rec[col.key]?.toString() || '—'}
                    </td>
                  ))}
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-500/10 transition"
                      title="Delete Record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground italic">
          No records found.
        </div>
      )}
    </div>
  );
}
