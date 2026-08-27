'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppointmentsPage from '../appointments/page';
import { useWorkspace } from '@/hooks/use-workspace';

export default function BookingTripPage() {
  const router = useRouter();
  const { currentIndustry } = useWorkspace();

  useEffect(() => {
    if (currentIndustry && currentIndustry !== 'travel') {
      router.replace('/appointments');
    }
  }, [currentIndustry, router]);

  if (currentIndustry !== 'travel') return null;

  return <AppointmentsPage />;
}
