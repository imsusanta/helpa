import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Dashboard - Helpa Studio',
};

export default async function AdminDashboardPage() {
  // Ensure only Super Admins can access this page
  await requireSuperAdmin();

  return <AdminDashboardClient />;
}
