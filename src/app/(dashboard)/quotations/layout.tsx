import { redirect } from 'next/navigation';

export default function LegacyQuotationsRedirectLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  void children;
  redirect('/trip-proposals');
}
