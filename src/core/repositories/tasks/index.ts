/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantContext } from '../tenant-context';
import type { ITasksRepository } from './tasks.interface';
import { SupabaseTasksRepository } from './supabase-tasks.repository';

export * from '../tenant-context';
export * from './tasks.interface';
export * from './supabase-tasks.repository';

/**
 * Creates or retrieves a tenant-scoped tasks repository instance.
 * Fails closed immediately if tenant context is missing or invalid.
 */
export function getTasksRepository(
  tenantContext: TenantContext,
  client?: SupabaseClient<any, any, any>
): ITasksRepository {
  return new SupabaseTasksRepository(tenantContext, client);
}
