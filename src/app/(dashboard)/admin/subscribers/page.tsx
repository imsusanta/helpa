import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminTenantsClient } from '@/components/admin/admin-tenants-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Subscribers - Helpa Studio',
};

export default async function AdminSubscribersPage() {
  await requireSuperAdmin();

  return <AdminTenantsClient />;
}
