/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import {
  assertTenantContext,
  TenantContextError,
} from '@/core/repositories/tenant-context';
import {
  getTasksRepository,
  SupabaseTasksRepository,
} from '@/core/repositories/tasks';
import { GET as tasksGet, POST as tasksPost } from '@/app/api/tasks/route';
import {
  GET as taskGetById,
  PUT as taskPut,
  DELETE as taskDelete,
} from '@/app/api/tasks/[id]/route';
import { NextRequest } from 'next/server';
import * as accountAuth from '@/lib/auth/account';
import * as serverDb from '@/lib/supabase/server';

function createMockSupabase(initialData: Record<string, any>[] = []) {
  const tableData: Record<string, any>[] = [...initialData];

  const createQueryBuilder = () => {
    let _selectedFields: string | null = null;
    const filters: Array<(row: any) => boolean> = [];
    let isSingle = false;
    let isMaybeSingle = false;
    let pendingInsert: any = null;
    let pendingUpdate: any = null;
    let isDelete = false;

    const builder: any = {
      select: vi.fn((fields?: string) => {
        _selectedFields = fields || '*';
        return builder;
      }),
      eq: vi.fn((col: string, val: any) => {
        filters.push((row) => row[col] === val);
        return builder;
      }),
      lte: vi.fn((col: string, val: any) => {
        filters.push((row) => row[col] <= val);
        return builder;
      }),
      gte: vi.fn((col: string, val: any) => {
        filters.push((row) => row[col] >= val);
        return builder;
      }),
      order: vi.fn((_col: string, _opts?: any) => {
        return builder;
      }),
      single: vi.fn(() => {
        isSingle = true;
        return builder;
      }),
      maybeSingle: vi.fn(() => {
        isMaybeSingle = true;
        return builder;
      }),
      insert: vi.fn((payload: any) => {
        pendingInsert = payload;
        return builder;
      }),
      update: vi.fn((payload: any) => {
        pendingUpdate = payload;
        return builder;
      }),
      delete: vi.fn(() => {
        isDelete = true;
        return builder;
      }),
      then: (resolve: any, reject: any) => {
        try {
          if (pendingInsert) {
            const newRow = {
              id: pendingInsert.id || `task-${Date.now()}-${Math.random()}`,
              ...pendingInsert,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            tableData.push(newRow);
            if (isSingle) {
              return resolve({ data: newRow, error: null });
            }
            return resolve({ data: [newRow], error: null });
          }

          if (isDelete) {
            const beforeCount = tableData.length;
            const remaining = tableData.filter(
              (row) => !filters.every((f) => f(row))
            );
            tableData.length = 0;
            tableData.push(...remaining);
            return resolve({
              data: null,
              error: null,
              count: beforeCount - remaining.length,
            });
          }

          if (pendingUpdate) {
            const matchingRows = tableData.filter((row) =>
              filters.every((f) => f(row))
            );
            if (matchingRows.length === 0) {
              if (isSingle) {
                return resolve({
                  data: null,
                  error: new Error('Row not found'),
                });
              }
              return resolve({ data: null, error: null });
            }
            matchingRows.forEach((r) => Object.assign(r, pendingUpdate));
            const result =
              isSingle || isMaybeSingle ? matchingRows[0] : matchingRows;
            return resolve({ data: result, error: null });
          }

          const matched = tableData.filter((row) =>
            filters.every((f) => f(row))
          );
          if (isSingle) {
            if (matched.length === 0) {
              return resolve({ data: null, error: new Error('Row not found') });
            }
            return resolve({ data: matched[0], error: null });
          }
          if (isMaybeSingle) {
            return resolve({ data: matched[0] || null, error: null });
          }
          return resolve({ data: matched, error: null });
        } catch (err) {
          if (reject) return reject(err);
          throw err;
        }
      },
    };

    return builder;
  };

  return {
    from: vi.fn((table: string) => {
      if (table !== 'tasks') {
        throw new Error(`Unexpected table ${table}`);
      }
      return createQueryBuilder();
    }),
    _tableData: tableData,
  };
}

describe('Tenant-Scoped Repository Layer — Tasks Domain', () => {
  const TENANT_A = 'tenant-aaa-1111-1111';
  const TENANT_B = 'tenant-bbb-2222-2222';

  describe('Requirement 4 & 5: Mandatory Context & Fail-Closed Guard', () => {
    it('assertTenantContext throws on null or undefined context', () => {
      expect(() => assertTenantContext(null as any)).toThrow(
        TenantContextError
      );
      expect(() => assertTenantContext(undefined as any)).toThrow(
        TenantContextError
      );
    });

    it('assertTenantContext throws on missing or whitespace accountId', () => {
      expect(() => assertTenantContext({ accountId: '' })).toThrow(
        TenantContextError
      );
      expect(() => assertTenantContext({ accountId: '   ' })).toThrow(
        TenantContextError
      );
      expect(() => assertTenantContext({} as any)).toThrow(TenantContextError);
      expect(() => assertTenantContext({ accountId: 12345 as any })).toThrow(
        TenantContextError
      );
    });

    it('SupabaseTasksRepository fails closed upon instantiation if context is invalid', () => {
      expect(() => new SupabaseTasksRepository({ accountId: '' })).toThrow(
        TenantContextError
      );
      expect(() => new SupabaseTasksRepository(null as any)).toThrow(
        TenantContextError
      );
      expect(() => getTasksRepository({ accountId: '   ' })).toThrow(
        TenantContextError
      );
    });

    it('Operations fail closed if tenant context is tampered or blanked at runtime', async () => {
      const repo = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        createMockSupabase() as any
      );
      // Attempt runtime tampering of readonly object via any
      (repo as any).tenantContext = { accountId: '' };

      await expect(repo.listTasks()).rejects.toThrow(TenantContextError);
      await expect(repo.getTaskById('t-1')).rejects.toThrow(TenantContextError);
      await expect(repo.createTask({ title: 'T' })).rejects.toThrow(
        TenantContextError
      );
      await expect(repo.updateTask('t-1', { title: 'T' })).rejects.toThrow(
        TenantContextError
      );
      await expect(repo.deleteTask('t-1')).rejects.toThrow(TenantContextError);
    });
  });

  describe('Requirement 6: Workspace Tampering Defense', () => {
    it('createTask ignores caller-supplied account_id and forces authenticated tenant', async () => {
      const mockDb = createMockSupabase();
      const repoA = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        mockDb as any
      );

      const created = await repoA.createTask({
        title: 'Tampering Attempt Task',
        // Attacker attempts to insert task into Tenant B's workspace
        account_id: TENANT_B,
      });

      expect(created.account_id).toBe(TENANT_A);
      expect(mockDb._tableData[0].account_id).toBe(TENANT_A);
      expect(mockDb._tableData[0].account_id).not.toBe(TENANT_B);
    });

    it('updateTask strips account_id to prevent reassigning task across workspaces', async () => {
      const mockDb = createMockSupabase([
        {
          id: 'task-a1',
          account_id: TENANT_A,
          title: 'Task A1',
          status: 'pending',
          priority: 'medium',
        },
      ]);
      const repoA = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        mockDb as any
      );

      const updated = await repoA.updateTask('task-a1', {
        title: 'Updated Title',
        // Attacker attempts to reassign task to Tenant B
        account_id: TENANT_B,
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.account_id).toBe(TENANT_A);
      expect(mockDb._tableData[0].account_id).toBe(TENANT_A);
      expect(mockDb._tableData[0].account_id).not.toBe(TENANT_B);
    });
  });

  describe('Requirement 6: Cross-Tenant Isolation (Read & Write)', () => {
    const seedData = [
      {
        id: 'task-a1',
        account_id: TENANT_A,
        title: 'Tenant A Secret Task',
        status: 'pending',
        priority: 'high',
      },
      {
        id: 'task-b1',
        account_id: TENANT_B,
        title: 'Tenant B Confidential Task',
        status: 'in_progress',
        priority: 'urgent',
      },
    ];

    it('listTasks strictly scopes to authenticated tenant and ignores other tenants', async () => {
      const mockDb = createMockSupabase(seedData);
      const repoA = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        mockDb as any
      );
      const repoB = new SupabaseTasksRepository(
        { accountId: TENANT_B },
        mockDb as any
      );

      const tasksA = await repoA.listTasks();
      expect(tasksA).toHaveLength(1);
      expect(tasksA[0].id).toBe('task-a1');
      expect(tasksA[0].account_id).toBe(TENANT_A);

      const tasksB = await repoB.listTasks();
      expect(tasksB).toHaveLength(1);
      expect(tasksB[0].id).toBe('task-b1');
      expect(tasksB[0].account_id).toBe(TENANT_B);
    });

    it('getTaskById returns null when attempting to access another tenant task', async () => {
      const mockDb = createMockSupabase(seedData);
      const repoA = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        mockDb as any
      );

      // Tenant A queries Tenant B's task ID
      const result = await repoA.getTaskById('task-b1');
      expect(result).toBeNull();
    });

    it('updateTask cannot update another tenant task', async () => {
      const mockDb = createMockSupabase(seedData);
      const repoA = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        mockDb as any
      );

      // Tenant A attempts to update Tenant B's task
      const result = await repoA.updateTask('task-b1', {
        title: 'Tampered Title',
      });

      expect(result).toBeNull();
      // Verify Tenant B's data remains pristine
      const bTask = mockDb._tableData.find((r) => r.id === 'task-b1');
      expect(bTask?.title).toBe('Tenant B Confidential Task');
    });

    it('deleteTask cannot delete another tenant task', async () => {
      const mockDb = createMockSupabase(seedData);
      const repoA = new SupabaseTasksRepository(
        { accountId: TENANT_A },
        mockDb as any
      );

      // Tenant A attempts to delete Tenant B's task
      await repoA.deleteTask('task-b1');

      // Verify Tenant B's data still exists
      const bTask = mockDb._tableData.find((r) => r.id === 'task-b1');
      expect(bTask).toBeDefined();
      expect(bTask?.id).toBe('task-b1');
    });
  });

  describe('Full CRUD Lifecycle within Tenant', () => {
    it('creates, retrieves, updates, lists with filters, and deletes a task', async () => {
      const mockDb = createMockSupabase();
      const repo = getTasksRepository({ accountId: TENANT_A }, mockDb as any);

      // 1. Create
      const created = await repo.createTask({
        title: 'Prepare Discharge Summary',
        description: 'Summarize clinical records for Room 402',
        priority: 'high',
        status: 'pending',
      });
      expect(created.id).toBeDefined();
      expect(created.title).toBe('Prepare Discharge Summary');
      expect(created.account_id).toBe(TENANT_A);

      // 2. Get by ID
      const fetched = await repo.getTaskById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe('Prepare Discharge Summary');

      // 3. Update
      const updated = await repo.updateTask(created.id, {
        status: 'in_progress',
        priority: 'urgent',
      });
      expect(updated?.status).toBe('in_progress');
      expect(updated?.priority).toBe('urgent');

      // 4. List with filter
      const urgentTasks = await repo.listTasks({ priority: 'urgent' });
      expect(urgentTasks).toHaveLength(1);
      expect(urgentTasks[0].id).toBe(created.id);

      const lowTasks = await repo.listTasks({ priority: 'low' });
      expect(lowTasks).toHaveLength(0);

      // 5. Delete
      const deleted = await repo.deleteTask(created.id);
      expect(deleted).toBe(true);

      const afterDelete = await repo.getTaskById(created.id);
      expect(afterDelete).toBeNull();
    });
  });

  describe('Requirement 7: Existing API Behavior & Contract Preservation', () => {
    it('GET /api/tasks returns 200 with { success: true, data: [...], requestId }', async () => {
      const mockDb = createMockSupabase([
        {
          id: 'task-api-1',
          account_id: TENANT_A,
          title: 'Review Blood Report',
          status: 'pending',
          priority: 'medium',
        },
      ]);
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-agent-1',
        role: 'viewer',
      } as any);
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue(mockDb as any);

      const req = new NextRequest('https://helpa.app/api/tasks?status=all', {
        headers: { 'x-request-id': 'req-test-123' },
      });

      const res = await tasksGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe('task-api-1');
      expect(json.requestId).toBe('req-test-123');
      expect(res.headers.get('cache-control')).toContain('no-store');
    });

    it('POST /api/tasks creates task, enforces tenant context, and returns 201', async () => {
      const mockDb = createMockSupabase();
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-agent-1',
        role: 'agent',
      } as any);
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue(mockDb as any);

      const req = new NextRequest('https://helpa.app/api/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-test-post',
        },
        body: JSON.stringify({
          title: 'Confirm Operation Theater',
          priority: 'urgent',
          account_id: TENANT_B, // Tampering attempt via POST body
        }),
      });

      const res = await tasksPost(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Confirm Operation Theater');
      // Must be bound to authenticated TENANT_A, not attacker's TENANT_B
      expect(json.data.account_id).toBe(TENANT_A);
      expect(json.requestId).toBe('req-test-post');
    });

    it('POST /api/tasks validates required title and returns 400', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-agent-1',
        role: 'agent',
      } as any);

      const req = new NextRequest('https://helpa.app/api/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-test-val',
        },
        body: JSON.stringify({ title: '   ' }),
      });

      const res = await tasksPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('TITLE_REQUIRED');
      expect(json.requestId).toBe('req-test-val');
    });

    it('GET /api/tasks/[id] returns 404 with TASK_NOT_FOUND when ID does not exist in tenant', async () => {
      const mockDb = createMockSupabase();
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-agent-1',
        role: 'viewer',
      } as any);
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue(mockDb as any);

      const req = new NextRequest(
        'https://helpa.app/api/tasks/non-existent-id',
        {
          headers: { 'x-request-id': 'req-test-404' },
        }
      );

      const res = await taskGetById(req, {
        params: Promise.resolve({ id: 'non-existent-id' }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('TASK_NOT_FOUND');
    });

    it('PUT /api/tasks/[id] updates task and returns 200', async () => {
      const mockDb = createMockSupabase([
        {
          id: 'task-put-1',
          account_id: TENANT_A,
          title: 'Initial Title',
          status: 'pending',
          priority: 'low',
        },
      ]);
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-agent-1',
        role: 'agent',
      } as any);
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue(mockDb as any);

      const req = new NextRequest('https://helpa.app/api/tasks/task-put-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-test-put',
        },
        body: JSON.stringify({
          title: 'Updated via API',
          status: 'completed',
        }),
      });

      const res = await taskPut(req, {
        params: Promise.resolve({ id: 'task-put-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Updated via API');
      expect(json.data.status).toBe('completed');
      expect(json.requestId).toBe('req-test-put');
    });

    it('DELETE /api/tasks/[id] deletes task and returns 200', async () => {
      const mockDb = createMockSupabase([
        {
          id: 'task-del-1',
          account_id: TENANT_A,
          title: 'To Delete',
          status: 'pending',
        },
      ]);
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-admin-1',
        role: 'admin',
      } as any);
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue(mockDb as any);

      const req = new NextRequest('https://helpa.app/api/tasks/task-del-1', {
        method: 'DELETE',
        headers: { 'x-request-id': 'req-test-del' },
      });

      const res = await taskDelete(req, {
        params: Promise.resolve({ id: 'task-del-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Task deleted successfully');
      expect(mockDb._tableData).toHaveLength(0);
    });

    it('Cross-tenant API isolation: Tenant A cannot read, update, or delete Tenant B task via API', async () => {
      const mockDb = createMockSupabase([
        {
          id: 'task-b-secret',
          account_id: TENANT_B,
          title: 'Tenant B Top Secret Task',
          status: 'pending',
        },
      ]);
      // Authenticated as Tenant A
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: TENANT_A,
        userId: 'user-agent-a',
        role: 'admin',
      } as any);
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue(mockDb as any);

      // 1. GET Tenant B task by Tenant A
      const getReq = new NextRequest(
        'https://helpa.app/api/tasks/task-b-secret',
        { headers: { 'x-request-id': 'req-cross-get' } }
      );
      const getRes = await taskGetById(getReq, {
        params: Promise.resolve({ id: 'task-b-secret' }),
      });
      expect(getRes.status).toBe(404);
      const getJson = await getRes.json();
      expect(getJson.error).toBe('TASK_NOT_FOUND');

      // 2. PUT Tenant B task by Tenant A
      const putReq = new NextRequest(
        'https://helpa.app/api/tasks/task-b-secret',
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req-cross-put',
          },
          body: JSON.stringify({ title: 'Hacked by Tenant A' }),
        }
      );
      const putRes = await taskPut(putReq, {
        params: Promise.resolve({ id: 'task-b-secret' }),
      });
      expect(putRes.status).toBe(500);
      const putJson = await putRes.json();
      expect(putJson.error).toBe('TASK_UPDATE_FAILED');
      expect(mockDb._tableData[0].title).toBe('Tenant B Top Secret Task');

      // 3. DELETE Tenant B task by Tenant A
      const delReq = new NextRequest(
        'https://helpa.app/api/tasks/task-b-secret',
        {
          method: 'DELETE',
          headers: { 'x-request-id': 'req-cross-del' },
        }
      );
      const delRes = await taskDelete(delReq, {
        params: Promise.resolve({ id: 'task-b-secret' }),
      });
      expect(delRes.status).toBe(200);
      // Tenant B's data MUST remain untouched in the database
      expect(mockDb._tableData).toHaveLength(1);
      expect(mockDb._tableData[0].id).toBe('task-b-secret');
    });
  });
});
