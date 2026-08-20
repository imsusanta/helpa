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

const dashboardUiCss = `
  :root { --helpa-sidebar-width: 252px; --helpa-green: #22c55e; --helpa-navy: #071426; }
  .helpa-dashboard-shell aside { width: var(--helpa-sidebar-width) !important; background: var(--helpa-navy) !important; }
  .helpa-dashboard-shell aside > div:first-child { height: 82px !important; padding-left: 18px !important; padding-right: 18px !important; }
  .helpa-dashboard-shell aside > div:nth-child(2) { padding: 14px 10px !important; }
  .helpa-dashboard-shell aside nav { gap: 2px !important; }
  .helpa-dashboard-shell aside nav > div > button,
  .helpa-dashboard-shell aside nav > a { min-height: 44px !important; border-radius: 10px !important; padding-left: 12px !important; padding-right: 12px !important; }
  .helpa-dashboard-shell aside nav > a { position: relative; }
  .helpa-dashboard-shell aside nav > a[href='/dashboard'] { background: rgba(34,197,94,.18) !important; color: #fff !important; box-shadow: inset 0 0 0 1px rgba(34,197,94,.22) !important; }
  .helpa-dashboard-shell aside nav > a[href='/dashboard']::before { content: ''; position: absolute; left: 0; top: 7px; bottom: 7px; width: 3px; border-radius: 999px; background: #22c55e; }
  .helpa-dashboard-shell aside > div:last-child { padding: 14px 16px !important; }
  .helpa-dashboard-main { background: #f7f9fb !important; }
  .helpa-dashboard-main > div { max-width: none !important; }
  .helpa-dashboard-main .helpa-kpi-grid { gap: 18px !important; }
  .helpa-dashboard-main .helpa-kpi-grid > section { min-height: 148px !important; border-color: #e4e9ef !important; border-radius: 16px !important; box-shadow: 0 2px 8px rgba(15,23,42,.045) !important; }
  .helpa-dashboard-main .helpa-kpi-grid > section:nth-child(n+5) { min-height: 180px !important; }
  .helpa-dashboard-main .helpa-panel-grid { gap: 18px !important; }
  .helpa-dashboard-main .helpa-panel-grid > section { min-height: 360px !important; border-color: #e4e9ef !important; border-radius: 16px !important; box-shadow: 0 2px 8px rgba(15,23,42,.045) !important; }
  .helpa-dashboard-main h1 { letter-spacing: -0.035em !important; }
  .helpa-dashboard-footer { min-height: 58px; border-top: 1px solid #e5e9ef; background: #f7f9fb; }
  @media (max-width: 1023px) { .helpa-dashboard-shell aside { width: 276px !important; } }
`;

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isRouteAllowed, manifest } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const isInbox = pathname === '/inbox';

  useEffect(() => { if (!loading && !user && typeof window !== 'undefined') router.push('/login'); }, [user, loading, router]);
  useEffect(() => {
    if (!loading && user && pathname && !isRouteAllowed(pathname)) {
      toast.info(`The page '${pathname}' is not available in the ${manifest.name} workspace.`);
      router.replace('/dashboard');
    }
  }, [loading, user, pathname, isRouteAllowed, manifest, router]);

  if (loading) return <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f8fa] text-slate-700"><div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /><p className="text-xs font-semibold text-slate-500">Loading your workspace...</p></div></div>;
  if (!user) return <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f7f8fa] text-slate-700"><Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-500" /><p className="text-sm font-semibold text-slate-700">Session expired. Redirecting to login...</p></div>;

  return (
    <div className="helpa-dashboard-shell flex h-screen overflow-hidden bg-[#f7f9fb] text-[#111827]">
      <style dangerouslySetInnerHTML={{ __html: dashboardUiCss }} />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className={cn(
          'helpa-dashboard-main min-h-0 flex-1 bg-[#f7f9fb]',
          isInbox ? 'flex flex-col overflow-hidden p-0' : 'overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 lg:px-6 lg:py-5'
        )}>
          <DashboardErrorBoundary onLogin={() => router.push('/login')}>{children}</DashboardErrorBoundary>
          {!isInbox && (
            <footer className="helpa-dashboard-footer mt-5 flex items-center justify-between px-1 text-xs text-slate-500 sm:px-2">
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
  return <AuthProvider><DashboardShellInner>{children}</DashboardShellInner></AuthProvider>;
}
