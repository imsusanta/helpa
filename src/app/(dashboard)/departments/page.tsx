'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  Building,
  Heart,
  Baby,
  Smile,
  Shield,
  Loader2,
  Users,
  Calendar,
} from 'lucide-react';

interface DepartmentData {
  name: string;
  doctorCount: number;
  appointmentCount: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEPT_TEMPLATES = [
  {
    name: 'Cardiology',
    description:
      'Specialized diagnostics and surgeries for heart disorders, stroke risks, and high blood pressure.',
    icon: Heart,
  },
  {
    name: 'Pediatrics',
    description:
      'Childcare, newborn screenings, vaccination trackers, and pediatric wellness plans.',
    icon: Baby,
  },
  {
    name: 'Dentistry',
    description:
      'Root canals, dental implants, aligners, and periodic teeth cleaning appointments.',
    icon: Smile,
  },
  {
    name: 'General Medicine',
    description:
      'Daily OPD, viral fever treatments, health checkups, and routine lab referrals.',
    icon: Building,
  },
  {
    name: 'Dermatology & Cosmetology',
    description:
      'Skin consultations, laser therapy, acne treatments, and hair restoration care.',
    icon: Shield,
  },
];

export default function DepartmentsPage() {
  const { accountId } = useAuth();
  const { terminology } = useWorkspace();
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!accountId) return;
      try {
        const [docsRes, apptsRes] = await Promise.all([
          fetch('/api/doctors', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/appointments', {
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);

        const doctorsPayload = docsRes.ok ? await docsRes.json() : { data: [] };
        const apptsPayload = apptsRes.ok ? await apptsRes.json() : { data: [] };

        const doctors = doctorsPayload.data || [];
        const appointments = apptsPayload.data || [];

        const mapped: DepartmentData[] = DEPT_TEMPLATES.map((tmpl) => {
          const docCount = doctors.filter(
            (d: { department?: string }) =>
              d.department?.toLowerCase() === tmpl.name.toLowerCase()
          ).length;
          const apptCount = appointments.filter(
            (a: { department?: string }) =>
              a.department?.toLowerCase() === tmpl.name.toLowerCase()
          ).length;

          return {
            ...tmpl,
            doctorCount: docCount,
            appointmentCount: apptCount,
          };
        });

        setDepartments(mapped);
      } catch (err) {
        console.error('Error loading department statistics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">
          Clinical Departments
        </h1>
        <p className="text-muted-foreground text-sm font-medium">
          Overview of active medical divisions and staffing levels.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const Icon = dept.icon;
          return (
            <div
              key={dept.name}
              className="bg-card border-border flex flex-col gap-4 rounded-xl border p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary shrink-0 rounded-lg p-2.5">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-foreground text-lg font-extrabold">
                  {dept.name}
                </h3>
              </div>
              <p className="text-muted-foreground flex-1 text-xs leading-relaxed">
                {dept.description}
              </p>
              <div className="border-border text-muted-foreground grid grid-cols-2 gap-4 border-t pt-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <Users className="text-muted-foreground/60 h-4.5 w-4.5 shrink-0" />
                  <span>
                    {dept.doctorCount} {terminology.staffMembers}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="text-muted-foreground/60 h-4.5 w-4.5 shrink-0" />
                  <span>
                    {dept.appointmentCount} {terminology.bookings}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
