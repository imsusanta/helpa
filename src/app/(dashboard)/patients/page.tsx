import { redirect } from 'next/navigation';

export default function PatientsRedirectPage() {
  redirect('/contacts');
}
