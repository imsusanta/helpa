import { requireSuperAdmin } from '@/lib/auth/admin';
import { AdminWhatsAppClient } from '@/components/admin/admin-whatsapp-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Super Admin WhatsApp Accounts - Helpa Studio',
};

export default async function AdminWhatsAppPage() {
  await requireSuperAdmin();

  return <AdminWhatsAppClient />;
}
