import type { Metadata } from 'next';
import { ThemedToaster } from '@/components/themed-toaster';
import { DashboardShell } from './dashboard-shell';

// Load the workspace template modal CSS only in the dashboard.
import '../../app/workspace-template-modal.css';

// Server layout whose only job is to declare "do not index" metadata
// for the authed app. robots.ts already disallows these paths at the
// crawler-level and middleware redirects unauthenticated visitors, so
// this is belt-and-suspenders — but SEO-critical if a URL ever leaks
// via a link shared externally.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ThemedToaster />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
