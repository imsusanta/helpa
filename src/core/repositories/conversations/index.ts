/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantContext } from '../tenant-context';
import type { IConversationsRepository } from './conversations.interface';
import { SupabaseConversationsRepository } from './supabase-conversations.repository';

export * from '../tenant-context';
export * from './conversations.interface';
export * from './supabase-conversations.repository';

/**
 * Creates or retrieves a tenant-scoped conversations repository instance.
 * Fails closed immediately if tenant context is missing or invalid.
 */
export function getConversationsRepository(
  tenantContext: TenantContext,
  client?: SupabaseClient<any, any, any>
): IConversationsRepository {
  return new SupabaseConversationsRepository(tenantContext, client);
}
