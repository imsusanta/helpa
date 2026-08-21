'use client';

import { useAuth } from '@/hooks/use-auth';
import { GenericDashboardClient } from './generic-dashboard-client';
import { Loader2 } from 'lucide-react';

export function DashboardDispatcher() {
  const { profileLoading } = useAuth();

  if (profileLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <GenericDashboardClient />;
}
