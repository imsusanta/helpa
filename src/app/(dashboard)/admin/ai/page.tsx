import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminAiInfrastructure } from '@/components/admin/admin-ai-infrastructure';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin AI Setup - Helpa Studio',
};

export default async function AdminAiPage() {
  await requireSuperAdmin();

  return <AdminAiInfrastructure />;
}
