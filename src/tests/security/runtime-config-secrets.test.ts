import { describe, expect, it } from 'vitest';
import {
  RuntimeConfigurationError,
  requireSupabasePublicConfig,
  requireSupabaseServiceRole,
} from '@/lib/runtime-config';

describe('Supabase runtime credentials', () => {
  it('requires public configuration instead of using embedded defaults', () => {
    expect(() => requireSupabasePublicConfig({})).toThrow(
      new RuntimeConfigurationError('MISSING_NEXT_PUBLIC_SUPABASE_URL')
    );
  });

  it('requires the service role key instead of using an embedded default', () => {
    expect(() => requireSupabaseServiceRole({})).toThrow(
      new RuntimeConfigurationError('MISSING_SUPABASE_SERVICE_ROLE_KEY')
    );
  });

  it('returns only explicitly supplied environment values', () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    };

    expect(requireSupabasePublicConfig(env)).toEqual({
      url: env.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    expect(requireSupabaseServiceRole(env)).toBe(env.SUPABASE_SERVICE_ROLE_KEY);
  });
});
