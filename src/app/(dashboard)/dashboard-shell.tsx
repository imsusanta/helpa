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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const isInbox = pathname === '/inbox';

  useEffect(() => {
    if (!loading && !user && typeof window !== 'undefined')
      router.push('/login');
  }, [user, loading, router]);
  useEffect(() => {
    if (!loading && user && pathname && !isRouteAllowed(pathname)) {
      toast.info(
        `The page '${pathname}' is not available in the ${manifest.name} workspace.`
      );
      router.replace('/dashboard');
    }
  }, [loading, user, pathname, isRouteAllowed, manifest, router]);

  if (loading)
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#f8fafc] text-slate-700">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#10b981]" />
          <p className="text-xs font-semibold text-slate-500">
            Loading your workspace...
          </p>
        </div>
      </div>
    );

  if (!user)
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f8fafc] text-slate-700">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#10b981]" />
        <p className="text-sm font-semibold text-slate-700">
          Session expired. Redirecting to login...
        </p>
      </div>
    );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] text-[#0f172a]">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main
          className={cn(
            'min-h-0 flex-1 bg-[#f8fafc]',
            isInbox
              ? 'flex flex-col overflow-hidden p-0'
              : 'overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6'
          )}
        >
          <DashboardErrorBoundary onLogin={() => router.push('/login')}>
            {children}
          </DashboardErrorBoundary>
          {!isInbox && (
            <footer className="mt-8 flex items-center justify-between text-xs text-slate-400">
              <span>© 2026 Helpa Studio. All rights reserved.</span>
              <span>v1.0.0</span>
            </footer>
          )}
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
