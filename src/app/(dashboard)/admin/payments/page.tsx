import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminPaymentsClient } from '@/components/admin/admin-payments-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Payments - Helpa Studio',
};

export default async function AdminPaymentsPage() {
  await requireSuperAdmin();

  return <AdminPaymentsClient />;
}
