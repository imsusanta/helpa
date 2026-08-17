import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminPlansClient } from '@/components/admin/admin-plans-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Plans & Pricing - Helpa Studio',
};

export default async function AdminPlansPage() {
  await requireSuperAdmin();

  return <AdminPlansClient />;
}
