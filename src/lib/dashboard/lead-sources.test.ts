import { describe, expect, it } from 'vitest';
import { aggregateLeadSources, normalizeLeadSourceKey } from './lead-sources';

describe('aggregateLeadSources', () => {
  it('returns an empty list when no source values exist', () => {
    expect(
      aggregateLeadSources([{ source: null, channel: null }, { source: '' }])
    ).toEqual([]);
  });

  it('uses source, falls back to channel, and aliases known values', () => {
    const slices = aggregateLeadSources([
      { source: 'whatsapp' },
      { source: 'WhatsApp_AI' },
      { source: 'facebook' },
      { source: null, channel: 'website' },
      { source: 'import' },
    ]);

    expect(slices.map((slice) => slice.key)).toEqual([
      'whatsapp',
      'facebook',
      'import',
    ]);
    expect(slices[0]).toMatchObject({
      label: 'WhatsApp',
      count: 2,
      percent: 40,
    });
    expect(slices.find((slice) => slice.key === 'facebook')?.percent).toBe(20);
  });

  it('normalizes common aliases onto the dashboard labels', () => {
    expect(normalizeLeadSourceKey('wa')).toBe('whatsapp');
    expect(normalizeLeadSourceKey('csv')).toBe('import');
    expect(normalizeLeadSourceKey('meta')).toBe('facebook');
  });
});
