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
import {
  fieldIsRequired,
  fieldIsVisible,
  getBookingFieldsForIndustry,
  getDefaultBookingFormConfig,
  isClinicBookingIndustry,
  isTravelBookingIndustry,
  mergeBookingFormConfig,
  type BookingFormConfig,
} from '@/lib/booking-form/config';
import { matchesBookingTab } from '@/lib/bookings/status';
import { useWorkspace } from '@/hooks/use-workspace';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes?: string | null;
  patient: { id: string; name: string; phone: string } | null;
  doctor: { id: string; name: string; specialization: string } | null;
  department: string;
  booking_id?: string;
  token_number?: number;
  queue_position?: number;
  travel_package_name?: string | null;
  travel_destination?: string | null;
  travel_guests_count?: number | null;
  travel_total_price_label?: string | null;
}

interface TourPackageOption {
  id: string;
  name: string;
  destination: string;
  starting_price: number | null;
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
  const { terminology, currentIndustry } = useWorkspace();
  const isClinical = isClinicBookingIndustry(currentIndustry);
  const isTravel = isTravelBookingIndustry(currentIndustry);
  const industryFields = getBookingFieldsForIndustry(currentIndustry);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tourPackages, setTourPackages] = useState<TourPackageOption[]>([]);
  const [formConfig, setFormConfig] = useState<BookingFormConfig>(
    getDefaultBookingFormConfig(currentIndustry)
  );
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
  const [packageId, setPackageId] = useState('');
  const [packageName, setPackageName] = useState('');
  const [destination, setDestination] = useState('');
  const [guestsCount, setGuestsCount] = useState('1');
  const [totalPrice, setTotalPrice] = useState('');
  const [service, setService] = useState('');
  const [property, setProperty] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAllData = useCallback(async () => {
    if (!accountId) return;

    try {
      // 1. Fetch booking form settings config
      fetch('/api/account/booking-form')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setFormConfig(
            mergeBookingFormConfig(currentIndustry, data?.config || null)
          );
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

      // 3. Fetch doctors dropdown (clinic / provider-based industries)
      if (!isTravel) {
        const docsRes = await fetch('/api/doctors?status=active', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (docsRes.ok) {
          const docsPayload = await docsRes.json();
          setDoctors(docsPayload.data || []);
        }
      }

      if (isTravel) {
        const pkgRes = await fetch('/api/travel/tour-packages?limit=100', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (pkgRes.ok) {
          const pkgPayload = await pkgRes.json();
          setTourPackages((pkgPayload.data || []) as TourPackageOption[]);
        }
      }
    } catch (err) {
      console.error('Error loading appointments dataset:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, currentIndustry, isTravel]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (!isClinical && activeTab === 'queue') {
      setActiveTab('upcoming');
    }
  }, [isClinical, activeTab]);

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
    setPackageId('');
    setPackageName('');
    setDestination('');
    setGuestsCount('1');
    setTotalPrice('');
    setService('');
    setProperty('');
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
    toast.info(`Selected patient ${p.name} (${p.patient_seq_id})`);
  }

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (fieldIsRequired(formConfig, 'name') && !patientName.trim()) {
      toast.error(`${terminology.person} name is required.`);
      return;
    }
    if (fieldIsRequired(formConfig, 'phone') && !mobileNumber.trim()) {
      toast.error('Mobile Number is required.');
      return;
    }
    if (fieldIsRequired(formConfig, 'doctor_id') && !doctorId) {
      toast.error(`${terminology.provider} selection is required.`);
      return;
    }
    if (
      !isTravel &&
      fieldIsRequired(formConfig, 'department') &&
      !department &&
      !doctorId
    ) {
      toast.error('Department selection is required.');
      return;
    }
    if (isTravel && !date) {
      toast.error('Travel date is required.');
      return;
    }
    if (!isTravel && !date) {
      toast.error(`${terminology.meeting} date is required.`);
      return;
    }
    if (!isTravel && !time) {
      toast.error(`${terminology.meeting} time is required.`);
      return;
    }
    if (isTravel && fieldIsRequired(formConfig, 'guests_count')) {
      const guests = Number(guestsCount);
      if (!Number.isFinite(guests) || guests < 1) {
        toast.error('Guests must be at least 1.');
        return;
      }
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
            metadata: isTravel
              ? {
                  destination: destination || null,
                  guests_count: guestsCount || null,
                  package_name: packageName || null,
                }
              : {
                  age: age || null,
                  gender: gender || null,
                  blood_group: bloodGroup || null,
                  guardian_name: guardianName || null,
                  guardian_mobile: guardianMobile || null,
                  insurance_provider: insuranceProvider || null,
                  insurance_number: insuranceNumber || null,
                  referred_by: referredBy || null,
                  service: service || null,
                  property: property || null,
                },
          }),
        });

        if (!contactRes.ok) {
          const errData = await contactRes.json().catch(() => ({}));
          throw new Error(
            errData.error ||
              `Failed to create ${terminology.person.toLowerCase()} profile`
          );
        }

        const contactData = await contactRes.json();
        finalContactId = contactData.data?.id;
      }

      const selectedDoc = doctors.find((d) => d.id === doctorId);
      const apptDept = isTravel
        ? destination.trim() || 'Travel'
        : selectedDoc
          ? selectedDoc.department
          : department || service || property || 'General';

      // Create appointment record via API
      const apptRes = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: finalContactId,
          doctor_id: isTravel ? null : doctorId || null,
          department: apptDept,
          appointment_date: apptDate,
          appointment_time: isTravel ? apptTime || '10:00' : apptTime,
          status: 'pending',
          notes: notes.trim() || null,
          ...(isTravel
            ? {
                package_id: packageId || null,
                package_name: packageName.trim() || 'Custom trip',
                destination: destination.trim(),
                travel_date: apptDate,
                guests_count: Math.max(1, Number(guestsCount) || 1),
                total_price: Number(totalPrice) || 0,
              }
            : {}),
        }),
      });

      if (!apptRes.ok) {
        const errData = await apptRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create appointment');
      }

      const apptData = await apptRes.json();
      const newAppt = apptData.data;

      // Clinic OPD tickets are WhatsApp PDFs; other industries skip that path.
      if (newAppt?.id && isClinical) {
        fetch(`/api/appointments/${newAppt.id}/confirm`, {
          method: 'POST',
        }).catch(() => {});
      }

      const tokenInfo =
        isClinical && newAppt?.token_number
          ? ` Token #${newAppt.token_number}`
          : '';
      const bookingInfo = newAppt?.booking_id ? ` (${newAppt.booking_id})` : '';
      toast.success(
        isTravel
          ? `Trip booking saved${bookingInfo}.`
          : `${terminology.booking} booked!${tokenInfo}${bookingInfo}${
              isClinical ? ' — WhatsApp confirmation sent.' : '.'
            }`
      );
      resetForm();
      setShowAddForm(false);
      loadAllData();
    } catch (err: unknown) {
      toast.error(
        `Failed to book ${terminology.booking.toLowerCase()}: ` +
          getErrorMessage(err)
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

      toast.success(`Appointment status updated to ${newStatus}.`);
      loadAllData();
    } catch (err: unknown) {
      toast.error('Status update failed: ' + getErrorMessage(err));
    }
  };

  const visibleTabs = isClinical
    ? (['upcoming', 'queue', 'completed', 'cancelled'] as const)
    : (['upcoming', 'completed', 'cancelled'] as const);

  const filteredAppointments = appointments.filter((appt) =>
    matchesBookingTab(appt.status, appt.appointment_date, activeTab)
  );

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
            {isClinical ? ' & OPD Reception' : ''}
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Live Desk
            </span>
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs font-medium">
            Schedule and manage {terminology.meetings.toLowerCase()} with
            {isClinical ? ' patient records and ' : ' '}WhatsApp confirmations.
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
              Mobile Number or Search Existing {terminology.person}
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
                  {terminology.person.toLowerCase()} profiles found for this
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
                    Selected Existing {terminology.person}:{' '}
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
                  Change {terminology.person}
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: industry-specific booking fields */}
          <div className="space-y-4">
            <h4 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Step 2: {terminology.person} & {terminology.booking} Details
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {industryFields
                .filter((field) => field.key !== 'phone')
                .filter((field) => fieldIsVisible(formConfig, field.key))
                .map((field) => {
                  const required = fieldIsRequired(formConfig, field.key);
                  const label = (
                    <Label className="text-xs font-semibold">
                      {field.label}{' '}
                      {required && <span className="text-amber-500">*</span>}
                    </Label>
                  );
                  const selectClass =
                    'border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none';

                  if (field.key === 'name') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder={
                            field.placeholder ||
                            `Enter full ${terminology.person.toLowerCase()} name...`
                          }
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'age') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'gender' || field.key === 'blood_group') {
                    const value = field.key === 'gender' ? gender : bloodGroup;
                    const onChange =
                      field.key === 'gender' ? setGender : setBloodGroup;
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <select
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          required={required}
                          className={selectClass}
                        >
                          <option value="">-- Select {field.label} --</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (field.key === 'dob') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'doctor_id' || field.input === 'provider') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <select
                          value={doctorId}
                          onChange={(e) => setDoctorId(e.target.value)}
                          required={required}
                          className={selectClass}
                        >
                          <option value="">-- Choose {field.label} --</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                              {d.department ? ` (${d.department})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (field.input === 'package') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <select
                          value={packageId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setPackageId(nextId);
                            const pkg = tourPackages.find(
                              (p) => p.id === nextId
                            );
                            if (pkg) {
                              setPackageName(pkg.name);
                              if (pkg.destination)
                                setDestination(pkg.destination);
                              if (pkg.starting_price != null) {
                                setTotalPrice(String(pkg.starting_price));
                              }
                            } else {
                              setPackageName('');
                            }
                          }}
                          required={required}
                          className={selectClass}
                        >
                          <option value="">-- Choose tour package --</option>
                          {tourPackages.map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name}
                              {pkg.destination ? ` · ${pkg.destination}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (
                    field.key === 'travel_date' ||
                    field.key === 'appointment_date'
                  ) {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'appointment_time') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'guests_count') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="number"
                          min={1}
                          value={guestsCount}
                          onChange={(e) => setGuestsCount(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'total_price') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="number"
                          min={0}
                          value={totalPrice}
                          onChange={(e) => setTotalPrice(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'destination') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'service') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={service}
                          onChange={(e) => setService(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'property') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={property}
                          onChange={(e) => setProperty(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'email') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'address') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'emergency_contact') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={emergencyContact}
                          onChange={(e) => setEmergencyContact(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'department') {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        {label}
                        <Input
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder={field.placeholder}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  if (field.key === 'notes') {
                    return (
                      <div
                        key={field.key}
                        className="space-y-1.5 md:col-span-2"
                      >
                        {label}
                        <Input
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={field.placeholder || field.description}
                          required={required}
                          className="bg-background text-sm"
                        />
                      </div>
                    );
                  }
                  return null;
                })}

              {isClinical &&
                !industryFields.some(
                  (field) => field.key === 'appointment_date'
                ) && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        {terminology.meeting} Date *
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
                        {terminology.meeting} Time *
                      </Label>
                      <Input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        className="bg-background text-sm"
                      />
                    </div>
                  </>
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
              ) : isClinical ? (
                'Schedule & Generate Token'
              ) : (
                `Save ${terminology.booking}`
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div
        className="border-border flex overflow-x-auto border-b"
        role="tablist"
        aria-label="Appointment views"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
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
        ))}
      </div>

      {/* Grid listing */}
      {displayAppointments.length === 0 ? (
        <div className="border-border bg-card mx-auto max-w-2xl rounded-2xl border border-dashed p-12 text-center">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-emerald-500/60" />
          <h3 className="text-foreground text-base font-bold">
            No {terminology.meetings.toLowerCase()} yet
          </h3>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs leading-relaxed">
            {terminology.meetings} booked by your AI assistant or{' '}
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
                  <th className="px-6 py-4">{terminology.person}</th>
                  {isTravel ? (
                    <>
                      <th className="px-6 py-4">Package</th>
                      <th className="px-6 py-4">Destination</th>
                      <th className="px-6 py-4">Guests</th>
                      <th className="px-6 py-4">Total</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">{terminology.booking} ID</th>
                      <th className="px-6 py-4">{terminology.provider}</th>
                      {isClinical && (
                        <th className="px-6 py-4">Token / Queue</th>
                      )}
                    </>
                  )}
                  <th className="px-6 py-4">
                    {isTravel ? 'Travel Date' : 'Schedule Date/Time'}
                  </th>
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
                              `Unknown ${terminology.person}`}
                          </div>
                          <div className="text-muted-foreground text-xs font-normal">
                            {appt.patient?.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    {isTravel ? (
                      <>
                        <td className="px-6 py-4 font-medium">
                          {appt.travel_package_name ||
                            appt.notes
                              ?.split('|')[0]
                              ?.replace('Travel Booking', '')
                              .trim() ||
                            'Trip booking'}
                        </td>
                        <td className="px-6 py-4">
                          {appt.travel_destination || appt.department || '—'}
                        </td>
                        <td className="px-6 py-4">
                          {appt.travel_guests_count ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          {appt.travel_total_price_label || '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          {appt.booking_id ? (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                              {appt.booking_id}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                        {isClinical && (
                          <td className="text-foreground/80 px-6 py-4 font-bold">
                            {appt.token_number
                              ? `#${appt.token_number} (Pos: ${appt.queue_position})`
                              : '—'}
                          </td>
                        )}
                      </>
                    )}
                    <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                          {isTravel
                            ? appt.appointment_date
                            : `${appt.appointment_date} at ${appt.appointment_time}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          String(appt.status).toLowerCase() === 'confirmed'
                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                            : String(appt.status).toLowerCase() === 'pending'
                              ? 'border border-amber-500/20 bg-amber-500/10 text-amber-500'
                              : String(appt.status).toLowerCase() === 'calling'
                                ? 'animate-pulse border border-blue-500/20 bg-blue-500/10 text-blue-500'
                                : String(appt.status).toLowerCase() ===
                                    'completed'
                                  ? 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-500'
                                  : 'border border-red-500/20 bg-red-500/10 text-red-500'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                    <td className="flex items-center justify-end space-x-1.5 px-6 py-4 text-right">
                      {isClinical && (
                        <>
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
                                  const data = await res
                                    .json()
                                    .catch(() => ({}));
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
                        </>
                      )}

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
                          {String(appt.status).toLowerCase() === 'pending' && (
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
                          {String(appt.status).toLowerCase() ===
                            'confirmed' && (
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
                          {String(appt.status).toLowerCase() !== 'cancelled' &&
                            String(appt.status).toLowerCase() !==
                              'completed' && (
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
