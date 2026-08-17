import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminSettingsClient } from '@/components/admin/admin-settings-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Settings - Helpa Studio',
};

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  return <AdminSettingsClient />;
}
