/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/server';
import { assertTenantContext, type TenantContext } from '../tenant-context';
import type {
  CreateTaskInput,
  ITasksRepository,
  TaskFilterOptions,
  TaskRecord,
  UpdateTaskInput,
} from './tasks.interface';

export class SupabaseTasksRepository implements ITasksRepository {
  readonly tenantContext: TenantContext;
  private readonly client: SupabaseClient<any, any, any>;

  constructor(
    tenantContext: TenantContext,
    client?: SupabaseClient<any, any, any>
  ) {
    assertTenantContext(tenantContext);
    this.tenantContext = tenantContext;
    this.client =
      client ?? (getAdminClient() as unknown as SupabaseClient<any, any, any>);
  }

  /**
   * Internal guard enforcing that active tenant context is non-empty before
   * executing any database access (fail-closed).
   */
  private ensureContext(): string {
    assertTenantContext(this.tenantContext);
    return this.tenantContext.accountId.trim();
  }

  async listTasks(filters?: TaskFilterOptions): Promise<TaskRecord[]> {
    const accountId = this.ensureContext();

    let query = this.client
      .from('tasks')
      .select(
        '*, contacts(id, name, phone), leads(id, name, stage), deals(id, name, value)'
      )
      .eq('account_id', accountId);

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority && filters.priority !== 'all') {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId);
    }
    if (filters?.contactId) {
      query = query.eq('contact_id', filters.contactId);
    }
    if (filters?.dealId) {
      query = query.eq('deal_id', filters.dealId);
    }
    if (filters?.dueBefore) {
      query = query.lte('due_at', filters.dueBefore);
    }
    if (filters?.dueAfter) {
      query = query.gte('due_at', filters.dueAfter);
    }

    const { data, error } = await query.order('due_at', { ascending: true });
    if (error) throw error;
    return (data as TaskRecord[]) || [];
  }

  async getTaskById(id: string): Promise<TaskRecord | null> {
    const accountId = this.ensureContext();
    if (!id || !id.trim()) return null;

    const { data, error } = await this.client
      .from('tasks')
      .select('*, contacts(*), leads(*), deals(*)')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw error;
    return (data as TaskRecord | null) ?? null;
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const accountId = this.ensureContext();

    // Anti-tampering guard: Never trust or permit caller-supplied account_id.
    // The record is strictly bound to the authenticated tenant context.
    const payload = {
      account_id: accountId,
      title: input.title.trim(),
      description: input.description ? String(input.description).trim() : null,
      due_at: input.due_at
        ? new Date(input.due_at).toISOString()
        : new Date().toISOString(),
      status: input.status ?? 'pending',
      priority: input.priority ?? 'medium',
      lead_id: input.lead_id || null,
      contact_id: input.contact_id || null,
      deal_id: input.deal_id || null,
      assigned_user_id: input.assigned_user_id || null,
      created_by: input.created_by || null,
    };

    const { data, error } = await this.client
      .from('tasks')
      .insert(payload)
      .select(
        '*, contacts(id, name, phone), leads(id, name, stage), deals(id, name, value)'
      )
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create task');
    }
    return data as TaskRecord;
  }

  async updateTask(
    id: string,
    input: UpdateTaskInput
  ): Promise<TaskRecord | null> {
    const accountId = this.ensureContext();
    if (!id || !id.trim()) return null;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updates.title = String(input.title).trim();
    if (input.description !== undefined) {
      updates.description = input.description
        ? String(input.description).trim()
        : null;
    }
    if (input.due_at !== undefined) {
      updates.due_at = new Date(input.due_at).toISOString();
    }
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.assigned_user_id !== undefined) {
      updates.assigned_user_id = input.assigned_user_id || null;
    }

    // Anti-tampering guard: Even if callers attempt to supply account_id,
    // strip it completely to prevent cross-workspace reassignment.
    delete (updates as any).account_id;

    const { data, error } = await this.client
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('account_id', accountId)
      .select('*, contacts(*), leads(*), deals(*)')
      .maybeSingle();

    if (error) throw error;
    return (data as TaskRecord | null) ?? null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const accountId = this.ensureContext();
    if (!id || !id.trim()) return false;

    const { error } = await this.client
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) throw error;
    return true;
  }
}
