import { redirect } from 'next/navigation';

export default function AdminTenantsRedirectPage() {
  redirect('/admin/subscribers');
}
