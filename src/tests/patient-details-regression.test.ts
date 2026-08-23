import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('patient list and details regression', () => {
  const detailsSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/contacts/contact-detail-view.tsx'),
    'utf8'
  );
  const contactsSource = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/contacts/page.tsx'),
    'utf8'
  );

  it('awaits Supabase query builders without chaining Promise-only catch', () => {
    expect(detailsSource).not.toMatch(/\.(?:single|maybeSingle)\(\)\s*\.catch/);
    expect(detailsSource).not.toMatch(/\.eq\([^\n]+\)\s*\.catch/);
  });

  it('keeps the data client stable and handles missing patient records', () => {
    expect(detailsSource).toContain('useMemo(() => createClient(), [])');
    expect(detailsSource).toContain(
      'could not be found or may have been deleted.'
    );
  });

  it('renders patient names as explicit detail controls', () => {
    expect(contactsSource).toContain('openDetail(contact.id)');
    expect(contactsSource).toContain('hover:underline');
  });
});
