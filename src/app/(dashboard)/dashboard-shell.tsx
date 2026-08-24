'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardErrorBoundary } from '@/components/dashboard/error-boundary';
import { DashboardShellSkeleton } from '@/components/ui/page-skeletons';

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

  if (loading) return <DashboardShellSkeleton />;

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
    <div className="dashboard-shell flex h-screen min-w-0 overflow-hidden bg-[#f8fafc] text-[#0f172a]">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main
          className={cn(
            'dashboard-main min-h-0 min-w-0 flex-1 bg-[#f8fafc]',
            isInbox
              ? 'flex flex-col overflow-hidden p-0'
              : 'overflow-x-auto overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6'
          )}
        >
          {isInbox ? (
            <DashboardErrorBoundary onLogin={() => router.push('/login')}>
              {children}
            </DashboardErrorBoundary>
          ) : (
            <div key={pathname} className="animate-page-in">
              <DashboardErrorBoundary onLogin={() => router.push('/login')}>
                {children}
              </DashboardErrorBoundary>
            </div>
          )}
        </main>
      </div>
      <style jsx global>{`
        @media (max-width: 1023px) {
          .dashboard-shell > aside {
            contain: layout paint style;
            will-change: transform;
            overscroll-behavior: contain;
          }
        }

        .dashboard-main tbody > tr {
          content-visibility: auto;
          contain-intrinsic-size: auto 56px;
        }
      `}</style>
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
