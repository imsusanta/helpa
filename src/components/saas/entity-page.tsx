'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { getIndustryModule } from '@/modules/registry';
import { parseContactCsv } from '@/lib/contacts/parse-contact-csv';
import type { FieldConfig, EntityConfig } from '@/modules/types';

const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  students: {
    tableName: 'coaching_students',
    label: 'Student',
    pluralLabel: 'Students',
    fields: [
      { key: 'name', label: 'Student Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
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
  },
  packages: {
    tableName: 'travel_packages',
    label: 'Tour Package',
    pluralLabel: 'Tour Packages',
    fields: [
      { key: 'name', label: 'Package Name', type: 'text', required: true },
      { key: 'destination', label: 'Destination', type: 'text', required: true },
      { key: 'duration_days', label: 'Duration (Days)', type: 'number', required: true },
      { key: 'price', label: 'Price (in ₹)', type: 'number', required: true },
      { key: 'description', label: 'Description', type: 'text' },
    ]
  },
  bookings: {
    tableName: 'travel_bookings',
    label: 'Booking',
    pluralLabel: 'Bookings',
    fields: [
      { key: 'travel_date', label: 'Travel Date', type: 'date', required: true },
      { key: 'guests_count', label: 'Number of Guests', type: 'number', required: true },
      { key: 'total_price', label: 'Total Price (in ₹)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Confirmed', 'Cancelled'], required: true },
    ]
  },
  customers: {
    tableName: 'contacts',
    label: 'Customer',
    pluralLabel: 'Customers',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
      { key: 'email', label: 'Email Address', type: 'text' },
      { key: 'company', label: 'Company / Notes', type: 'text' },
    ]
  },
  members: {
    tableName: 'contacts',
    label: 'Member',
    pluralLabel: 'Members',
    fields: [
      { key: 'name', label: 'Member Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true },
      { key: 'email', label: 'Email Address', type: 'text' },
      { key: 'company', label: 'Company / Notes', type: 'text' },
    ]
  },
  trainers: {
    tableName: 'realestate_agents',
    label: 'Trainer',
    pluralLabel: 'Trainers',
    fields: [
      { key: 'name', label: 'Trainer Name', type: 'text', required: true },
      { key: 'phone', label: 'Phone Number', type: 'text' },
      { key: 'email', label: 'Email Address', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], required: true },
    ]
  },
  memberships: {
    tableName: 'coaching_courses',
    label: 'Membership Plan',
    pluralLabel: 'Membership Plans',
    fields: [
      { key: 'name', label: 'Plan Name', type: 'text', required: true },
      { key: 'fee', label: 'Monthly Fee (in ₹)', type: 'number', required: true },
      { key: 'duration', label: 'Duration (e.g. 1 Month)', type: 'text' },
    ]
  },
  classes: {
    tableName: 'coaching_batches',
    label: 'Class',
    pluralLabel: 'Classes',
    fields: [
      { key: 'name', label: 'Class Name', type: 'text', required: true },
      { key: 'timing', label: 'Timings (e.g. 6 PM - 7 PM)', type: 'text', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], required: true },
    ]
  },
  reservations: {
    tableName: 'appointments',
    label: 'Reservation',
    pluralLabel: 'Reservations',
    fields: [
      { key: 'appointment_date', label: 'Reservation Date', type: 'date', required: true },
      { key: 'appointment_time', label: 'Reservation Time (e.g. 20:00)', type: 'text', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'completed', 'cancelled'], required: true },
    ]
  },
  tables: {
    tableName: 'coaching_courses',
    label: 'Table',
    pluralLabel: 'Tables',
    fields: [
      { key: 'name', label: 'Table Name/Number', type: 'text', required: true },
      { key: 'fee', label: 'Seating Capacity', type: 'number', required: true },
      { key: 'duration', label: 'Area / Placement (e.g. Terrace)', type: 'text' },
    ]
  },
  orders: {
    tableName: 'deals',
    label: 'Order',
    pluralLabel: 'Orders',
    fields: [
      { key: 'title', label: 'Order Description', type: 'text', required: true },
      { key: 'value', label: 'Order Value (in ₹)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['open', 'won', 'lost'], required: true },
    ]
  }
};

export function EntityPage({ entityKey }: { entityKey: string }) {
  const { accountId, account } = useAuth();
  const db = createClient();

  const activeModule = getIndustryModule(account?.industry);
  const mergedConfigs = {
    ...ENTITY_CONFIGS,
    ...(activeModule?.entityConfigs || {})
  };
  const config = mergedConfigs[entityKey];
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk Import State
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');

  // Form State
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleBulkImport = async () => {
    if (!accountId || parsedRows.length === 0) return;
    setImporting(true);
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    try {
      const { data: { session } } = await db.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      for (const row of parsedRows) {
        const rawPhone = row.phone?.trim();
        if (!rawPhone) {
          skipCount++;
          continue;
        }

        // Normalize phone number (simple cleanup or normalizeKey)
        const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone.replace(/[^0-9]/g, '')}`;

        try {
          // 1. Check if contact already exists
          let contactId = '';
          const { data: existingContact } = await db
            .from('contacts')
            .select('id')
            .eq('account_id', accountId)
            .eq('phone', phone)
            .maybeSingle();

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            // Create contact record
            const { data: newContact, error: contactErr } = await db
              .from('contacts')
              .insert({
                account_id: accountId,
                user_id: user.id,
                name: row.name || `Student ${phone.slice(-4)}`,
                phone: phone,
              })
              .select('id')
              .single();

            if (contactErr) throw contactErr;
            contactId = newContact.id;
          }

          // 2. Check if student already exists in coaching_students
          const { data: existingStudent } = await db
            .from('coaching_students')
            .select('id')
            .eq('id', contactId)
            .maybeSingle();

          if (existingStudent) {
            // Already a student
            skipCount++;
            continue;
          }

          // 3. Create coaching_students record
          const studentSeq = `STU-${Math.floor(10000 + Math.random() * 90000)}`;
          const { error: studentErr } = await db
            .from('coaching_students')
            .insert({
              id: contactId,
              account_id: accountId,
              student_seq_id: studentSeq,
              status: 'active',
              gender: 'Male',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (studentErr) throw studentErr;
          successCount++;
        } catch (err) {
          console.error('Import row error:', err);
          failCount++;
        }
      }

      toast.success(`Import complete! ${successCount} students imported.`);
      if (skipCount > 0) toast.info(`${skipCount} duplicate/existing students skipped.`);
      if (failCount > 0) toast.error(`${failCount} rows failed to import.`);

      setImportOpen(false);
      setFileName('');
      setParsedRows([]);
      loadRecords();
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

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
      let query = db.from(config.tableName).select('*');
      if (config.tableName === 'coaching_students') {
        query = db.from('coaching_students').select('*, contact:contacts(name, phone)');
      }

      const { data, error } = await query
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
      const { data: { session } } = await db.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const dataToInsert: any = {
        ...formData,
        account_id: accountId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Special case: if table extends contacts table (like students and leads), we need to create a dummy contact or bind it.
      // For simplicity, if they aren't bound to contacts directly, we generate a random contact uuid or insert directly.
      if (config.tableName === 'coaching_students' || config.tableName === 'realestate_leads') {
        const contactName = config.tableName === 'coaching_students' ? formData.name : (formData.parent_name || formData.lead_seq_id);
        const contactPhone = config.tableName === 'coaching_students' ? formData.phone : '+9100000000';

        // Create a contact first
        const { data: newContact, error: contactErr } = await db
          .from('contacts')
          .insert({
            account_id: accountId,
            user_id: user.id,
            name: contactName,
            phone: contactPhone,
          })
          .select('id')
          .single();

        if (contactErr) throw contactErr;
        dataToInsert.id = newContact.id;

        if (config.tableName === 'coaching_students') {
          dataToInsert.student_seq_id = `STU-${Math.floor(10000 + Math.random() * 90000)}`;
          dataToInsert.status = 'active';
          delete dataToInsert.name;
          delete dataToInsert.phone;
        }
      }

      // Special case: resolve foreign key constraints dynamically
      if (config.tableName === 'travel_bookings') {
        const { data: firstPack } = await db.from('travel_packages').select('id').limit(1);
        const { data: firstContact } = await db.from('contacts').select('id').limit(1);
        
        let packageId = firstPack?.[0]?.id;
        if (!packageId) {
          const { data: newPack } = await db.from('travel_packages').insert({
            account_id: accountId,
            name: 'Standard Package',
            destination: 'Universal Destination',
            price: 5000,
            duration_days: 3
          }).select('id').single();
          packageId = newPack?.id;
        }

        let contactId = firstContact?.[0]?.id;
        if (!contactId) {
          const { data: newContact } = await db.from('contacts').insert({
            account_id: accountId,
            name: 'Sample Customer',
            phone: '+910000000000'
          }).select('id').single();
          contactId = newContact?.id;
        }

        dataToInsert.package_id = packageId;
        dataToInsert.contact_id = contactId;
      }

      if (config.tableName === 'coaching_admissions') {
        const { data: firstContact } = await db.from('contacts').select('id').limit(1);
        const { data: firstCourse } = await db.from('coaching_courses').select('id').limit(1);

        let studentId = firstContact?.[0]?.id;
        if (!studentId) {
          const { data: newContact } = await db.from('contacts').insert({
            account_id: accountId,
            name: 'Sample Student',
            phone: '+910000000000'
          }).select('id').single();
          studentId = newContact?.id;
        }

        let courseId = firstCourse?.[0]?.id;
        if (!courseId) {
          const { data: newCourse } = await db.from('coaching_courses').insert({
            account_id: accountId,
            name: 'Basic Course',
            fee: 1000,
            duration: '3 Months'
          }).select('id').single();
          courseId = newCourse?.id;
        }

        dataToInsert.student_id = studentId;
        dataToInsert.course_id = courseId;
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

  const tableFields = [...config.fields];
  if (entityKey === 'students') {
    tableFields.push(
      { key: 'student_seq_id', label: 'Student ID', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' }
    );
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          {entityKey === 'students' && (
            <Button 
              onClick={() => { setImportOpen(!importOpen); setIsOpen(false); }} 
              variant="outline"
              className="cursor-pointer border-border text-muted-foreground hover:bg-muted font-semibold flex items-center gap-1.5 rounded-full px-5"
            >
              <Upload className="h-4 w-4" /> Bulk Import
            </Button>
          )}
          <Button onClick={() => { setIsOpen(!isOpen); setImportOpen(false); }} className="cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center gap-1.5 rounded-full px-5">
            <Plus className="h-4 w-4" /> Add {config.label}
          </Button>
        </div>
      </div>

      {importOpen && entityKey === 'students' && (
        <div className="border border-border rounded-xl bg-card p-6 space-y-4 max-w-xl animate-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground text-sm border-b border-border pb-2">
            Bulk Import Students
          </h3>
          <div className="space-y-3">
            <div 
              onClick={() => document.getElementById('student-csv-input')?.click()}
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-all bg-background/50"
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              {fileName ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{fileName}</p>
                  <p className="text-xs text-emerald-500 font-medium mt-0.5">{parsedRows.length} students found</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Click to upload Student CSV / Excel file</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Headers required: "phone", "name"</p>
                </div>
              )}
            </div>
            <input
              id="student-csv-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                try {
                  const text = await file.text();
                  const { rows } = parseContactCsv(text);
                  if (rows.length === 0) {
                    toast.error('No valid rows found. Ensure CSV has a "phone" column header.');
                    return;
                  }
                  setParsedRows(rows);
                  toast.success(`${rows.length} students parsed successfully.`);
                } catch (err: any) {
                  toast.error('Failed to parse CSV: ' + err.message);
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground italic">
              💡 Tip: If you have an Excel (.xlsx) file, save it as a CSV (.csv) first to upload.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setImportOpen(false); setFileName(''); setParsedRows([]); }} className="cursor-pointer rounded-full px-5">
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleBulkImport} 
              disabled={importing || parsedRows.length === 0} 
              className="cursor-pointer rounded-full px-6 font-semibold"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Import {parsedRows.length > 0 ? parsedRows.length : ''} Students
            </Button>
          </div>
        </div>
      )}

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
                {tableFields.map(col => (
                  <th key={col.key} className="p-4">{col.label}</th>
                ))}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                  {tableFields.map(col => {
                    let val = col.type === 'number' && col.key.includes('fee') ? `₹${rec[col.key] || 0}` : rec[col.key]?.toString() || '—';
                    if (col.key === 'name' && rec.contact) {
                      val = rec.contact.name || '—';
                    } else if (col.key === 'phone' && rec.contact) {
                      val = rec.contact.phone || '—';
                    }
                    return (
                      <td key={col.key} className="p-4 font-medium text-foreground">
                        {val}
                      </td>
                    );
                  })}
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
