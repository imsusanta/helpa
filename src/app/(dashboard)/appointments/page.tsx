'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Loader2,
  X,
  UserCheck,
  Users,
  Search,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/lib/booking-form/config';
import { useWorkspace } from '@/hooks/use-workspace';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string;
  patient: { id: string; name: string; phone: string } | null;
  doctor: { id: string; name: string; specialization: string } | null;
  department: string;
  booking_id?: string;
  token_number?: number;
  queue_position?: number;
}

interface Doctor {
  id: string;
  name: string;
  department: string;
  specialization: string;
}

interface PatientSearchMatch {
  id: string;
  patient_seq_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  emergency_contact?: string;
}

export default function AppointmentsPage() {
  const { accountId } = useAuth();
  const { terminology, manifest } = useWorkspace();
  const isClinical = manifest.id === 'hospital_clinic';
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [formConfig, setFormConfig] = useState<
    Record<string, { show: boolean; required: boolean }>
  >(DEFAULT_BOOKING_FORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'upcoming' | 'queue' | 'completed' | 'cancelled'
  >('upcoming');

  // Booking Form Modal State
  const [showAddForm, setShowAddForm] = useState(false);

  // Real-time Patient Lookup & Family Sharing State
  const [mobileQuery, setMobileQuery] = useState('');
  const [patientMatches, setPatientMatches] = useState<PatientSearchMatch[]>(
    []
  );
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchMatch | null>(null);
  const [createNewFamilyMember, setCreateNewFamilyMember] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Dynamic Form Field States
  const [patientName, setPatientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [email, setEmail] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [department, setDepartment] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAllData = useCallback(async () => {
    if (!accountId) return;

    try {
      // 1. Fetch booking form settings config
      fetch('/api/account/booking-form')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.config) {
            setFormConfig({
              ...DEFAULT_BOOKING_FORM_CONFIG,
              ...data.config,
            });
          }
        })
        .catch((e) => console.error('Form config load error:', e));

      // 2. Fetch appointments
      const apptsRes = await fetch('/api/appointments', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (apptsRes.ok) {
        const apptsPayload = await apptsRes.json();
        setAppointments((apptsPayload.data ?? []) as unknown as Appointment[]);
      }

      // 3. Fetch doctors dropdown
      const docsRes = await fetch('/api/doctors?status=active', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (docsRes.ok) {
        const docsPayload = await docsRes.json();
        setDoctors(docsPayload.data || []);
      }
    } catch (err) {
      console.error('Error loading appointments dataset:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Real-time phone search effect with debouncing
  useEffect(() => {
    if (!mobileQuery || mobileQuery.trim().length < 4) {
      setPatientMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const res = await fetch(
          `/api/patients/search?phone=${encodeURIComponent(mobileQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setPatientMatches(data.patients || []);
        }
      } catch (err) {
        console.error('Patient phone search failed:', err);
      } finally {
        setSearchingPatients(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [mobileQuery]);

  function resetForm() {
    setPatientName('');
    setMobileNumber('');
    setMobileQuery('');
    setPatientMatches([]);
    setSelectedPatient(null);
    setCreateNewFamilyMember(false);
    setAge('');
    setGender('');
    setDob('');
    setAddress('');
    setBloodGroup('');
    setEmergencyContact('');
    setGuardianName('');
    setGuardianMobile('');
    setEmail('');
    setDoctorId('');
    setDepartment('');
    setInsuranceProvider('');
    setInsuranceNumber('');
    setReferredBy('');
    setDate('');
    setTime('');
    setNotes('');
  }

  function handleSelectExistingPatient(p: PatientSearchMatch) {
    setSelectedPatient(p);
    setPatientName(p.name);
    setMobileNumber(p.phone);
    setAge('');
    setGender(p.gender || '');
    setAddress(p.address || '');
    setBloodGroup(p.blood_group || '');
    setEmail(p.email || '');
    setEmergencyContact(p.emergency_contact || '');
    setCreateNewFamilyMember(false);
    toast.info(
      `Selected ${terminology.contact.toLowerCase()} ${p.name} (${p.patient_seq_id})`
    );
  }

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate mandatory required fields based on formConfig
    if (formConfig.name?.required && !patientName.trim()) {
      toast.error(`${terminology.contact} name is required.`);
      return;
    }
    if (formConfig.phone?.required && !mobileNumber.trim()) {
      toast.error('Mobile Number is required.');
      return;
    }
    if (formConfig.doctor_id?.required && !doctorId) {
      toast.error(`${terminology.provider} selection is required.`);
      return;
    }
    if (formConfig.department?.required && !department && !doctorId) {
      toast.error('Department selection is required.');
      return;
    }
    if (!date) {
      toast.error(`${terminology.booking} date is required.`);
      return;
    }
    if (!time) {
      toast.error(`${terminology.booking} time is required.`);
      return;
    }

    const apptDate = date;
    const apptTime = time;

    setSaving(true);

    try {
      let finalContactId = selectedPatient?.id;

      // Create new patient contact if no existing patient selected or creating new family member
      if (!finalContactId || createNewFamilyMember) {
        const contactRes = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: patientName.trim(),
            phone: mobileNumber.trim(),
            email: email.trim() || null,
            address: address.trim() || null,
            metadata: {
              age: age || null,
              gender: gender || null,
              blood_group: bloodGroup || null,
              guardian_name: guardianName || null,
              guardian_mobile: guardianMobile || null,
              insurance_provider: insuranceProvider || null,
              insurance_number: insuranceNumber || null,
              referred_by: referredBy || null,
            },
          }),
        });

        if (!contactRes.ok) {
          const errData = await contactRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create patient profile');
        }

        const contactData = await contactRes.json();
        finalContactId = contactData.data?.id;
      }

      const selectedDoc = doctors.find((d) => d.id === doctorId);
      const apptDept = selectedDoc
        ? selectedDoc.department
        : department || 'General';

      // Create appointment record via API
      const apptRes = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: finalContactId,
          doctor_id: doctorId || null,
          department: apptDept,
          appointment_date: apptDate,
          appointment_time: apptTime,
          status: 'pending',
          notes: notes.trim() || null,
        }),
      });

      if (!apptRes.ok) {
        const errData = await apptRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create appointment');
      }

      const apptData = await apptRes.json();
      const newAppt = apptData.data;

      // Trigger WhatsApp Confirmation notification asynchronously
      if (newAppt?.id) {
        fetch(`/api/appointments/${newAppt.id}/confirm`, {
          method: 'POST',
        }).catch(() => {});
      }

      const tokenInfo = newAppt?.token_number
        ? ` Token #${newAppt.token_number}`
        : '';
      const bookingInfo = newAppt?.booking_id ? ` (${newAppt.booking_id})` : '';
      toast.success(
        `${terminology.booking} created!${tokenInfo}${bookingInfo} — WhatsApp confirmation sent.`
      );
      resetForm();
      setShowAddForm(false);
      loadAllData();
    } catch (err: unknown) {
      toast.error(
        `Failed to create ${terminology.booking.toLowerCase()}: ${getErrorMessage(err)}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (apptId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/appointments/${apptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update appointment status');
      }

      toast.success(`${terminology.booking} status updated to ${newStatus}.`);
      loadAllData();
    } catch (err: unknown) {
      toast.error('Status update failed: ' + getErrorMessage(err));
    }
  };

  // Filter based on active tabs
  const filteredAppointments = appointments.filter((appt) => {
    const today = new Date().toISOString().split('T')[0];
    if (activeTab === 'upcoming') {
      return (
        (appt.status === 'pending' ||
          appt.status === 'confirmed' ||
          appt.status === 'calling') &&
        appt.appointment_date >= today
      );
    }
    if (activeTab === 'queue') {
      return (
        appt.appointment_date === today &&
        appt.status !== 'cancelled' &&
        appt.status !== 'completed'
      );
    }
    if (activeTab === 'completed') {
      return (
        appt.status === 'completed' ||
        (appt.appointment_date < today && appt.status !== 'cancelled')
      );
    }
    return appt.status === 'cancelled' || appt.status === 'no_show';
  });

  const displayAppointments =
    activeTab === 'queue'
      ? [...filteredAppointments].sort(
          (a, b) => (a.token_number || 0) - (b.token_number || 0)
        )
      : filteredAppointments;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-extrabold">
            {terminology.meetings}
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Live Desk
            </span>
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs font-medium">
            {isClinical
              ? `Schedule and manage ${terminology.contact.toLowerCase()} consultations with automatic IDs and WhatsApp confirmations.`
              : `Schedule and manage ${terminology.meetings.toLowerCase()} with WhatsApp confirmations.`}
          </p>
        </div>
        <Button
          onClick={() => {
            if (!showAddForm) resetForm();
            setShowAddForm(!showAddForm);
          }}
          className="cursor-pointer self-start bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/10 transition-all hover:bg-emerald-600 sm:self-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Plus className="mr-2 h-4 w-4" /> {terminology.bookingAction}
        </Button>
      </div>

      {/* Configurable Booking Form Modal */}
      {showAddForm && (
        <form
          onSubmit={handleCreateAppointment}
          className="bg-card animate-in fade-in slide-in-from-top-4 max-w-3xl space-y-6 rounded-2xl border border-emerald-500/20 p-6 shadow-xl duration-200"
        >
          <div className="border-border flex items-center justify-between border-b pb-3">
            <h3 className="text-foreground flex items-center gap-2 text-lg font-extrabold">
              <Sparkles className="size-5 text-emerald-500" />
              {terminology.bookingAction}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Step 1: Mobile Number Search & Multi-Patient Detection */}
          <div className="bg-muted/30 border-border space-y-3 rounded-xl border p-4">
            <Label className="text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
              <Search className="size-3.5 text-emerald-500" /> Step 1: Enter
              Mobile Number or Search Existing {terminology.contact}
            </Label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={mobileNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMobileNumber(val);
                    setMobileQuery(val);
                    if (selectedPatient && selectedPatient.phone !== val) {
                      setSelectedPatient(null);
                    }
                  }}
                  placeholder="Type Mobile Number (e.g. 9876543210)..."
                  className="bg-background pr-8 text-sm font-semibold"
                  required={formConfig.phone?.required}
                />
                {searchingPatients && (
                  <Loader2 className="absolute top-3 right-2.5 size-4 animate-spin text-emerald-500" />
                )}
              </div>
            </div>

            {/* Display Matching Patient Cards for Family Sharing */}
            {patientMatches.length > 0 && !selectedPatient && (
              <div className="animate-in fade-in space-y-2 pt-2 duration-200">
                <p className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Users className="size-3.5" /> Multiple{' '}
                  {terminology.contact.toLowerCase()} profiles found for this
                  mobile number:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {patientMatches.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectExistingPatient(p)}
                      className="border-border bg-card group cursor-pointer space-y-1 rounded-lg border p-3 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-foreground text-xs font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {p.name}
                        </span>
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {p.patient_seq_id}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[10px]">
                        Phone: {p.phone} {p.gender ? `• ${p.gender}` : ''}{' '}
                        {p.blood_group ? `• ${p.blood_group}` : ''}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPatient(null);
                      setCreateNewFamilyMember(true);
                      toast.info(
                        'Registering new family member profile for this number.'
                      );
                    }}
                    className="cursor-pointer border-dashed border-emerald-500/40 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    + Register New Family Member for this Number
                  </Button>
                </div>
              </div>
            )}

            {/* Selected Patient Banner */}
            {selectedPatient && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Selected Existing {terminology.contact}:{' '}
                    <strong>{selectedPatient.name}</strong> (
                    <span className="font-mono font-bold">
                      {selectedPatient.patient_seq_id}
                    </span>
                    )
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPatient(null)}
                  className="text-muted-foreground hover:text-foreground h-6 text-[11px]"
                >
                  Change {terminology.contact}
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Patient & Clinical Information Fields (Configurable Rendering) */}
          <div className="space-y-4">
            <h4 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Step 2: {terminology.contact} & {terminology.booking} Details
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Patient Name */}
              {formConfig.name?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {terminology.contact} Name{' '}
                    {formConfig.name?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder={`Enter full ${terminology.contact.toLowerCase()} name...`}
                    required={formConfig.name?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Age */}
              {formConfig.age?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Age{' '}
                    {formConfig.age?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 35"
                    required={formConfig.age?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Gender */}
              {formConfig.gender?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Gender{' '}
                    {formConfig.gender?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required={formConfig.gender?.required}
                    className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="">-- Select Gender --</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {/* Date of Birth */}
              {formConfig.dob?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Date of Birth{' '}
                    {formConfig.dob?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required={formConfig.dob?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Blood Group */}
              {formConfig.blood_group?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Blood Group{' '}
                    {formConfig.blood_group?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    required={formConfig.blood_group?.required}
                    className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="">-- Select Blood Group --</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(
                      (bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}

              {/* Preferred Doctor */}
              {formConfig.doctor_id?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {terminology.provider}{' '}
                    {formConfig.doctor_id?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    required={formConfig.doctor_id?.required}
                    className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="">
                      -- Choose {terminology.provider} --
                    </option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department */}
              {formConfig.department?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Clinical Department{' '}
                    {formConfig.department?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Cardiology, Orthopedics, General OPD"
                    required={formConfig.department?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Address */}
              {formConfig.address?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Address{' '}
                    {formConfig.address?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="City / Area / Full Address"
                    required={formConfig.address?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Emergency Contact */}
              {formConfig.emergency_contact?.show && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Emergency Contact{' '}
                    {formConfig.emergency_contact?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Contact Name & Mobile..."
                    required={formConfig.emergency_contact?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}

              {/* Date & Time (Always Visible for Appointment) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {terminology.booking} Date *
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {terminology.booking} Time *
                </Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="bg-background text-sm"
                />
              </div>

              {/* Internal Notes */}
              {formConfig.notes?.show && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold">
                    Special Instructions / Triage Notes{' '}
                    {formConfig.notes?.required && (
                      <span className="text-amber-500">*</span>
                    )}
                  </Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Symptoms, past history, or receptionist notes..."
                    required={formConfig.notes?.required}
                    className="bg-background text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-border flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="cursor-pointer bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/10 transition-all hover:bg-emerald-600 dark:bg-emerald-600"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating {terminology.booking}...
                </>
              ) : (
                'Schedule & Generate Token'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="border-border flex border-b">
        {(['upcoming', 'queue', 'completed', 'cancelled'] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? 'border-emerald-500 font-bold text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {tab === 'queue'
                ? 'Live Queue'
                : tab === 'upcoming'
                  ? `Upcoming ${terminology.meetings}`
                  : tab === 'completed'
                    ? 'Completed'
                    : 'Cancelled / No Show'}
            </button>
          )
        )}
      </div>

      {/* Grid listing */}
      {displayAppointments.length === 0 ? (
        <div className="border-border bg-card mx-auto max-w-2xl rounded-2xl border border-dashed p-12 text-center">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-emerald-500/60" />
          <h3 className="text-foreground text-base font-bold">
            No {terminology.meetings.toLowerCase()} yet
          </h3>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs leading-relaxed">
            {terminology.meetings} created by your AI assistant or{' '}
            {terminology.staff.toLowerCase()} will appear here.
          </p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="mt-4 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="mr-1.5 size-3.5" />
            {terminology.bookingAction}
          </Button>
        </div>
      ) : (
        <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-muted-foreground w-full text-left text-sm">
              <thead className="bg-muted/50 border-border text-foreground border-b text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-4">{terminology.contact}</th>
                  <th className="px-6 py-4">Booking ID</th>
                  <th className="px-6 py-4">{terminology.provider}</th>
                  <th className="px-6 py-4">Token / Queue</th>
                  <th className="px-6 py-4">Schedule Date/Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border text-foreground divide-y">
                {displayAppointments.map((appt) => (
                  <tr
                    key={appt.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <User className="h-4.5 w-4.5 text-emerald-500" />
                        <div>
                          <div className="text-foreground font-bold">
                            {appt.patient?.name ||
                              `Unknown ${terminology.contact}`}
                          </div>
                          <div className="text-muted-foreground text-xs font-normal">
                            {appt.patient?.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-2">
                        <UserCheck className="text-muted-foreground/70 h-4.5 w-4.5" />
                        <div>
                          <div>{appt.doctor?.name || 'Unassigned'}</div>
                          <div className="text-muted-foreground text-xs font-normal">
                            {appt.doctor?.specialization || appt.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {appt.booking_id ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                          {appt.booking_id}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-foreground/80 px-6 py-4 font-bold">
                      {appt.token_number
                        ? `#${appt.token_number} (Pos: ${appt.queue_position})`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                          {appt.appointment_date} at {appt.appointment_time}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          appt.status === 'confirmed'
                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                            : appt.status === 'pending'
                              ? 'border border-amber-500/20 bg-amber-500/10 text-amber-500'
                              : appt.status === 'calling'
                                ? 'animate-pulse border border-blue-500/20 bg-blue-500/10 text-blue-500'
                                : appt.status === 'completed'
                                  ? 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-500'
                                  : 'border border-red-500/20 bg-red-500/10 text-red-500'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                    <td className="flex items-center justify-end space-x-1.5 px-6 py-4 text-right">
                      <a
                        href={`/api/appointments/${appt.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-border bg-card hover:bg-muted text-foreground inline-flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        PDF Slip
                      </a>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          toast.info(
                            "Sending Watermarked OPD Ticket PDF to patient's WhatsApp..."
                          );
                          try {
                            const res = await fetch(
                              `/api/appointments/${appt.id}/confirm`,
                              { method: 'POST' }
                            );
                            if (res.ok) {
                              toast.success(
                                "OPD Ticket PDF sent to patient's WhatsApp!"
                              );
                            } else {
                              const data = await res.json().catch(() => ({}));
                              toast.error(
                                data.error || 'Failed to send ticket PDF'
                              );
                            }
                          } catch (error: unknown) {
                            toast.error(
                              'Error sending ticket PDF: ' +
                                getErrorMessage(error)
                            );
                          }
                        }}
                        className="cursor-pointer border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        Send Ticket PDF
                      </Button>

                      {activeTab === 'queue' && (
                        <>
                          {appt.status !== 'calling' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleUpdateStatus(appt.id, 'calling')
                              }
                              className="cursor-pointer border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-500 hover:bg-blue-500/20"
                            >
                              Call Token
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleUpdateStatus(appt.id, 'completed')
                            }
                            className="cursor-pointer border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500 hover:bg-emerald-500/20"
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleUpdateStatus(appt.id, 'cancelled')
                            }
                            className="cursor-pointer border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/20"
                          >
                            Skip
                          </Button>
                        </>
                      )}

                      {activeTab !== 'queue' && (
                        <>
                          {appt.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleUpdateStatus(appt.id, 'confirmed')
                              }
                              className="cursor-pointer border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500 hover:bg-emerald-500/20"
                            >
                              Confirm
                            </Button>
                          )}
                          {appt.status === 'confirmed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleUpdateStatus(appt.id, 'completed')
                              }
                              className="cursor-pointer border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-500 hover:bg-indigo-500/20"
                            >
                              Complete
                            </Button>
                          )}
                          {appt.status !== 'cancelled' &&
                            appt.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleUpdateStatus(appt.id, 'cancelled')
                                }
                                className="cursor-pointer border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/20"
                              >
                                Cancel
                              </Button>
                            )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
