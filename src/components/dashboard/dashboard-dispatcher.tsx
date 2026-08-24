'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { DashboardContentSkeleton } from '@/components/ui/page-skeletons';

const GenericDashboardClient = dynamic(
  () =>
    import('./generic-dashboard-client').then(
      (module) => module.GenericDashboardClient
    ),
  {
    loading: () => <DashboardContentSkeleton />,
    ssr: false,
  }
);

export function DashboardDispatcher() {
  const { profileLoading } = useAuth();

  if (profileLoading) return <DashboardContentSkeleton />;

  return <GenericDashboardClient />;
}
