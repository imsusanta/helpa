'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardErrorBoundary } from '@/components/dashboard/error-boundary';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isRouteAllowed, manifest } = useWorkspace();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      if (typeof window !== 'undefined') {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  const pathname = usePathname();
  const isInbox = pathname === '/inbox';

  // Route protection: prevent access to irrelevant industry modules
  useEffect(() => {
    if (!loading && user && pathname && !isRouteAllowed(pathname)) {
      toast.info(
        `The page '${pathname}' is not available in the ${manifest.name} workspace.`
      );
      router.replace('/dashboard');
    }
  }, [loading, user, pathname, isRouteAllowed, manifest, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#030712] text-zinc-300">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-xs font-semibold text-zinc-400">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#030712] text-zinc-300">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm font-semibold text-zinc-200">
          Session expired. Redirecting to login...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main
          className={cn(
            'min-h-0 flex-1',
            isInbox
              ? 'flex flex-col overflow-hidden p-0 sm:p-0'
              : 'overflow-y-auto p-4 sm:p-6'
          )}
        >
          <DashboardErrorBoundary onLogin={() => router.push('/login')}>
            {children}
          </DashboardErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
