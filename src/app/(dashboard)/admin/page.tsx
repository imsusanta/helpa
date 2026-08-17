import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminOverviewClient } from '@/components/admin/admin-overview-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Overview - Helpa Studio',
};

export default async function AdminDashboardPage() {
  // Ensure only Super Admins can access this page
  await requireSuperAdmin();

  return <AdminOverviewClient />;
}
