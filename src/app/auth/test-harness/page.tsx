import { notFound } from 'next/navigation';
import { TestHarnessClient } from './test-harness-client';

export const dynamic = 'force-dynamic';

export default function TestHarnessPage() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.PLAYWRIGHT_TEST !== 'true'
  ) {
    notFound();
  }

  return <TestHarnessClient />;
}
