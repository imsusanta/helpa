import { KnowledgeBaseWorkspace } from '@/components/knowledge-base/knowledge-base-workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Knowledge Base - Helpa',
};

export default function KnowledgeBasePage() {
  return <KnowledgeBaseWorkspace />;
}
