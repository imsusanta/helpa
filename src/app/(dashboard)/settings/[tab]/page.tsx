import { SettingsView } from '@/components/settings/settings-view';

export const dynamic = 'force-dynamic';

interface SettingsTabPageProps {
  params: Promise<{ tab: string }>;
}

export async function generateMetadata({ params }: SettingsTabPageProps) {
  const { tab } = await params;
  const capitalized = tab.charAt(0).toUpperCase() + tab.slice(1);
  return {
    title: `${capitalized} Settings - Helpa`,
  };
}

export default async function SettingsTabPage({
  params,
}: SettingsTabPageProps) {
  const { tab } = await params;
  return <SettingsView initialTab={tab} />;
}
