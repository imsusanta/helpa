import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminSubscriptionsClient } from '@/components/admin/admin-subscriptions-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin Subscriptions & Billing - Helpa Studio',
};

export default async function AdminSubscriptionsPage() {
  await requireSuperAdmin();

  return <AdminSubscriptionsClient />;
}
