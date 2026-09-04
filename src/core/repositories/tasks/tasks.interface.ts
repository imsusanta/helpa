import type { TenantContext } from '../tenant-context';

export interface TaskRecord {
  id: string;
  account_id: string;
  contact_id: string | null;
  lead_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  assigned_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contacts?: { id: string; name: string; phone?: string | null } | null;
  leads?: { id: string; name: string; stage?: string | null } | null;
  deals?: { id: string; name: string; value?: number | null } | null;
  [key: string]: unknown;
}

export interface TaskFilterOptions {
  status?: string;
  priority?: string;
  leadId?: string;
  contactId?: string;
  dealId?: string;
  dueBefore?: string;
  dueAfter?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  due_at?: string;
  status?: string;
  priority?: string;
  lead_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  assigned_user_id?: string | null;
  created_by?: string | null;
  /**
   * If provided by caller/payload, this must be ignored/overwritten by the
   * repository to prevent workspace tampering.
   */
  account_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  due_at?: string;
  status?: string;
  priority?: string;
  assigned_user_id?: string | null;
  /**
   * Tampering attempt: updating account_id is forbidden and must be ignored.
   */
  account_id?: string;
}

export interface ITasksRepository {
  readonly tenantContext: TenantContext;
  listTasks(filters?: TaskFilterOptions): Promise<TaskRecord[]>;
  getTaskById(id: string): Promise<TaskRecord | null>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(id: string, input: UpdateTaskInput): Promise<TaskRecord | null>;
  deleteTask(id: string): Promise<boolean>;
}
