import { EntityPage } from '@/components/saas/entity-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TrainersPage() {
  return <EntityPage entityKey="trainers" />;
}
