/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Appwrite data adapter for the parts of the application that still use the
 * old fluent data-access shape.  It intentionally has no appwrite dependency
 * or network target: every request goes to Appwrite's REST API.
 */

import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

type AnyRecord = Record<string, any>;

export type AppwriteCompatClient = any;
export type AppwriteClient = AppwriteCompatClient;
export type AppwriteError = any;

const endpoint = APPWRITE_CONFIG.endpoint.replace(/\/$/, '');

function browserSession(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const local = window.localStorage.getItem('appwrite_session');
    if (local) return local;

    const match = document.cookie.match(
      /(?:^|;\s*)(?:a_session_[a-zA-Z0-9]+|appwrite_session)=([^;]*)/
    );
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function saveBrowserSession(secret: string | undefined) {
  if (typeof window === 'undefined' || !secret) return;
  try {
    window.localStorage.setItem('appwrite_session', secret);
    document.cookie = `appwrite_session=${encodeURIComponent(secret)}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // Storage may be disabled; the httpOnly cookie still protects the session.
  }
}

function clearBrowserSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('appwrite_session');
    document.cookie =
      'appwrite_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  } catch {
    // Ignore storage failures during sign-out.
  }
}

function requestHeaders(
  extra?: HeadersInit,
  sessionOverride?: string,
  useApiKey = true
): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
  });
  const session = sessionOverride || browserSession();
  if (session) headers.set('X-Appwrite-Session', session);
  if (useApiKey && typeof window === 'undefined' && APPWRITE_CONFIG.apiKey) {
    headers.set('X-Appwrite-Key', APPWRITE_CONFIG.apiKey);
  }
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

function appwriteQuery(operator: string, field?: string, value?: any): string {
  const query: AnyRecord = { method: operator };
  if (field !== undefined) query.attribute = toAppwriteField(field);
  if (value !== undefined) {
    query.values = Array.isArray(value) ? value : [value];
  }
  return JSON.stringify(query);
}

function toCamelCase(field: string): string {
  return field.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}

function toAppwriteField(field: string): string {
  if (field === 'id') return '$id';
  if (field === 'created_at') return '$createdAt';
  if (field === 'updated_at') return '$updatedAt';
  return toCamelCase(field);
}

function toSnakeCase(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function normalizeRecord(document: AnyRecord): AnyRecord {
  const result: AnyRecord = { ...document };
  if (document.$id && !result.id) result.id = document.$id;
  if (document.$createdAt && !result.created_at) {
    result.created_at = document.$createdAt;
  }
  if (document.$updatedAt && !result.updated_at) {
    result.updated_at = document.$updatedAt;
  }
  Object.entries(document).forEach(([key, value]) => {
    const snake = toSnakeCase(key);
    if (snake !== key && result[snake] === undefined) result[snake] = value;
  });
  return result;
}

function normalizePayload(record: AnyRecord): AnyRecord {
  const payload = { ...record };
  delete payload.id;
  delete payload.$id;
  delete payload.$createdAt;
  delete payload.$updatedAt;
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [toCamelCase(key), value])
  );
}

function queryValue(value: any): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

class QueryBuilder {
  private readonly table: string;
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' =
    'select';
  private payload: any;
  private fields: string | undefined;
  private filters: string[] = [];
  private ordering: string[] = [];
  private maxRows: number | undefined;
  private offset = 0;
  private selectionOptions: AnyRecord = {};
  private readonly session?: string;
  private readonly useApiKey: boolean;

  constructor(table: string, session?: string, useApiKey = true) {
    this.table = table;
    this.session = session;
    this.useApiKey = useApiKey;
  }

  select(fields = '*', options: AnyRecord = {}) {
    this.fields = fields;
    this.selectionOptions = options;
    return this;
  }

  insert(payload: any) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload: any) {
    this.operation = 'upsert';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push(appwriteQuery('equal', field, queryValue(value)));
    return this;
  }
  neq(field: string, value: any) {
    this.filters.push(appwriteQuery('notEqual', field, queryValue(value)));
    return this;
  }
  gt(field: string, value: any) {
    this.filters.push(appwriteQuery('greaterThan', field, queryValue(value)));
    return this;
  }
  gte(field: string, value: any) {
    this.filters.push(
      appwriteQuery('greaterThanEqual', field, queryValue(value))
    );
    return this;
  }
  lt(field: string, value: any) {
    this.filters.push(appwriteQuery('lessThan', field, queryValue(value)));
    return this;
  }
  lte(field: string, value: any) {
    this.filters.push(appwriteQuery('lessThanEqual', field, queryValue(value)));
    return this;
  }
  in(field: string, values: any[]) {
    this.filters.push(appwriteQuery('equal', field, values.map(queryValue)));
    return this;
  }
  is(field: string, value: any) {
    this.filters.push(
      value === null
        ? appwriteQuery('isNull', field)
        : appwriteQuery('equal', field, queryValue(value))
    );
    return this;
  }
  ilike(field: string, value: string) {
    this.filters.push(appwriteQuery('search', field, value.replace(/%/g, '')));
    return this;
  }
  like(field: string, value: string) {
    return this.ilike(field, value);
  }
  contains(field: string, value: any) {
    this.filters.push(appwriteQuery('contains', field, value));
    return this;
  }
  containedBy() {
    return this;
  }
  not(field: string, operator: string, value: any) {
    if (operator === 'is' && value === null) {
      this.filters.push(appwriteQuery('isNotNull', field));
    }
    return this;
  }
  or(expression: string) {
    const parts = expression
      .split(/,(?=[a-zA-Z_$][\w$]*\.)/)
      .map((part) => part.trim())
      .filter(Boolean);
    const queries = parts.map((part) => {
      const match = part.match(/^([\w$]+)\.(ilike|like)\.(.*)$/);
      if (match) {
        return appwriteQuery('search', match[1], match[3].replace(/%/g, ''));
      }
      return appwriteQuery('equal', part.split('.')[0], '');
    });
    if (queries.length) {
      this.filters.push(
        appwriteQuery(
          'or',
          undefined,
          queries.map((query) => JSON.parse(query))
        )
      );
    }
    return this;
  }
  filter(field: string, operator: string, value: any) {
    return (this as any)[operator]?.(field, value) || this;
  }
  match(values: AnyRecord) {
    Object.entries(values).forEach(([field, value]) => this.eq(field, value));
    return this;
  }
  order(field: string, options: AnyRecord = {}) {
    this.ordering.push(
      appwriteQuery(
        options.ascending === false ? 'orderDesc' : 'orderAsc',
        field
      )
    );
    return this;
  }
  limit(value: number) {
    this.maxRows = value;
    return this;
  }
  range(from: number, to: number) {
    this.offset = from;
    this.maxRows = Math.max(0, to - from + 1);
    return this;
  }
  csv() {
    return this;
  }
  textSearch() {
    return this;
  }

  async single() {
    const result = await this.execute();
    if (!result.data || result.data.length !== 1) {
      return {
        data: null,
        error: { message: 'Expected exactly one document', code: 'PGRST116' },
        count: result.count,
      };
    }
    return { ...result, data: result.data[0] };
  }

  async maybeSingle() {
    const result = await this.execute();
    if (!result.data || result.data.length === 0)
      return { ...result, data: null };
    return { ...result, data: result.data[0] };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      if (this.operation === 'select') return await this.list();
      if (this.operation === 'insert') return await this.create();
      if (this.operation === 'upsert') return await this.create(true);
      if (this.operation === 'update') return await this.mutate('PATCH');
      return await this.mutate('DELETE');
    } catch (error: any) {
      return {
        data: null,
        error: {
          message: error?.message || 'Appwrite request failed',
          code: error?.code,
          hint: error?.hint,
        },
        count: null,
      };
    }
  }

  private async list() {
    const params = new URLSearchParams();
    const queries = [...this.filters, ...this.ordering];
    if (this.maxRows !== undefined)
      queries.push(appwriteQuery('limit', undefined, this.maxRows));
    if (this.offset)
      queries.push(appwriteQuery('offset', undefined, this.offset));
    queries.forEach((query, index) =>
      params.append(`queries[${index}]`, query)
    );
    const response = await fetch(
      `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(this.table)}/documents?${params}`,
      {
        headers: requestHeaders(undefined, this.session, this.useApiKey),
        cache: 'no-store',
        credentials: 'include',
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message), body);
    const documents = (body.documents || []).map(normalizeRecord);
    return {
      data: this.selectionOptions.head ? null : documents,
      error: null,
      count: body.total ?? documents.length,
    };
  }

  private async create(_upsert = false) {
    const records = Array.isArray(this.payload) ? this.payload : [this.payload];
    const documents: any[] = [];
    for (const record of records) {
      const response = await fetch(
        `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(this.table)}/documents`,
        {
          method: 'POST',
          headers: requestHeaders(undefined, this.session, this.useApiKey),
          body: JSON.stringify({
            documentId: record.id || 'unique()',
            data: normalizePayload(record),
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message), body);
      documents.push(normalizeRecord(body));
    }
    return {
      data: Array.isArray(this.payload) ? documents : documents[0],
      error: null,
      count: documents.length,
    };
  }

  private async mutate(method: 'PATCH' | 'DELETE') {
    const current = await this.list();
    const documents = current.data || [];
    const updated: any[] = [];
    for (const document of documents) {
      const response = await fetch(
        `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(this.table)}/documents/${encodeURIComponent(document.$id || document.id)}`,
        {
          method,
          headers: requestHeaders(undefined, this.session, this.useApiKey),
          ...(method === 'PATCH'
            ? { body: JSON.stringify({ data: normalizePayload(this.payload) }) }
            : {}),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message), body);
      if (method === 'PATCH') updated.push(normalizeRecord(body));
    }
    return { data: updated, error: null, count: documents.length };
  }
}

export function createDataClient(
  sessionOverride?: string,
  useApiKey = true
): AppwriteCompatClient {
  const client: AnyRecord = {
    from: (table: string) =>
      new QueryBuilder(table, sessionOverride, useApiKey),
    rpc: async (functionName: string, params: AnyRecord = {}) => {
      const failure = (message: string) => ({
        data: null,
        error: { message },
        count: null,
      });
      const findOne = async (table: string, field: string, value: any) =>
        client.from(table).select('*').eq(field, value).maybeSingle();

      try {
        if (functionName === 'peek_invitation') {
          const invitation = await findOne(
            'account_invitations',
            'token_hash',
            params.p_token_hash
          );
          if (invitation.error || !invitation.data) {
            return { data: { ok: false, reason: 'not_found' }, error: null };
          }
          const row = invitation.data;
          if (row.accepted_at || row.acceptedAt) {
            return { data: { ok: false, reason: 'used' }, error: null };
          }
          const expiresAt = row.expires_at || row.expiresAt;
          if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
            return { data: { ok: false, reason: 'expired' }, error: null };
          }
          const account = await findOne(
            'accounts',
            'id',
            row.account_id || row.accountId
          );
          return {
            data: {
              ok: true,
              account_name: account.data?.name || account.data?.accountName,
              role: row.role || row.account_role,
              expires_at: expiresAt,
            },
            error: null,
          };
        }

        if (functionName === 'redeem_invitation') {
          const auth = await client.auth.getUser();
          if (!auth.data?.user) return failure('Unauthorized');
          const invitation = await findOne(
            'account_invitations',
            'token_hash',
            params.p_token_hash
          );
          if (invitation.error || !invitation.data) {
            return failure('Invitation not found');
          }
          const row = invitation.data;
          const accountId = row.account_id || row.accountId;
          const profile = await findOne(
            'profiles',
            'user_id',
            auth.data.user.id
          );
          if (
            profile.data?.account_id === accountId ||
            profile.data?.accountId === accountId
          ) {
            return failure('You are already a member of this account');
          }
          if (profile.data?.id || profile.data?.$id) {
            await client
              .from('profiles')
              .update({
                account_id: accountId,
                account_role: row.role || 'agent',
              })
              .eq('id', profile.data.id || profile.data.$id);
          }
          await client
            .from('account_invitations')
            .update({
              accepted_at: new Date().toISOString(),
              accepted_by_user_id: auth.data.user.id,
            })
            .eq('id', row.id || row.$id);
          return { data: accountId, error: null };
        }

        if (functionName === 'delete_patient_atomic') {
          const patient = await client
            .from('patients')
            .select('*')
            .eq('id', params.p_patient_id)
            .eq('account_id', params.p_account_id)
            .maybeSingle();
          if (patient.error || !patient.data) {
            return failure('Patient not found in tenant');
          }
          const deleted = await client
            .from('patients')
            .delete()
            .eq('id', params.p_patient_id)
            .eq('account_id', params.p_account_id);
          if (deleted.error) return deleted;
          return {
            data: { deleted_at: new Date().toISOString() },
            error: null,
          };
        }

        if (functionName === 'update_patient_consent_atomic') {
          const status = params.p_consent_status;
          if (!['pending', 'opted_in', 'opted_out'].includes(status)) {
            return failure(`Invalid consent_status: ${status}`);
          }
          const patient = await client
            .from('patients')
            .select('*')
            .eq('id', params.p_patient_id)
            .eq('account_id', params.p_account_id)
            .maybeSingle();
          if (patient.error || !patient.data) {
            return failure('Patient not found in tenant');
          }
          const updated = await client
            .from('patients')
            .update({
              consent_status: status,
              consent_source: params.p_consent_source,
              consent_updated_at: new Date().toISOString(),
              policy_version: params.p_policy_version,
              updated_at: new Date().toISOString(),
            })
            .eq('id', params.p_patient_id)
            .eq('account_id', params.p_account_id);
          if (updated.error) return updated;
          return {
            data: { updated_at: new Date().toISOString() },
            error: null,
          };
        }

        if (
          functionName === 'increment_automation_execution_count' ||
          functionName === 'increment_flow_execution_count'
        ) {
          const table = functionName.includes('automation')
            ? 'automations'
            : 'flows';
          const field = functionName.includes('automation')
            ? 'p_automation_id'
            : 'p_flow_id';
          const row = await client
            .from(table)
            .select('*')
            .eq('id', params[field])
            .maybeSingle();
          if (row.error || !row.data) return failure(`${table} not found`);
          const current = Number(row.data.execution_count || 0);
          const updated = await client
            .from(table)
            .update({ execution_count: current + 1 })
            .eq('id', params[field]);
          return updated.error ? updated : { data: null, error: null };
        }

        return failure(
          `Appwrite function '${functionName}' is not implemented`
        );
      } catch (error: any) {
        return failure(
          error?.message || `Appwrite function '${functionName}' failed`
        );
      }
    },
    auth: {
      getUser: async () => {
        const response = await fetch(`${endpoint}/account`, {
          headers: requestHeaders(undefined, sessionOverride, useApiKey),
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({}));
        return response.ok
          ? {
              data: {
                user: {
                  id: body.$id,
                  email: body.email,
                  user_metadata: { full_name: body.name },
                },
              },
              error: null,
            }
          : { data: { user: null }, error: body };
      },
      getSession: async () => {
        const token = browserSession();
        return {
          data: { session: token ? { access_token: token } : null },
          error: null,
        };
      },
      signInWithPassword: async ({ email, password }: AnyRecord) => {
        const response = await fetch(`${endpoint}/account/sessions/email`, {
          method: 'POST',
          headers: requestHeaders(undefined, sessionOverride, useApiKey),
          body: JSON.stringify({ email, password }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) return { data: { session: null }, error: body };
        saveBrowserSession(body.secret);
        return { data: { session: body }, error: null };
      },
      signOut: async () => {
        clearBrowserSession();
        return { error: null };
      },
      updateUser: async ({ password, data }: AnyRecord) => ({
        data: null,
        error: null,
        password,
        metadata: data,
      }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any) => {
          const form = new FormData();
          form.append('fileId', 'unique()');
          form.append('file', file, path);
          const headers = requestHeaders(undefined, sessionOverride, useApiKey);
          headers.delete('Content-Type');
          const response = await fetch(
            `${endpoint}/storage/buckets/${bucket}/files`,
            { method: 'POST', headers, body: form }
          );
          const body = await response.json().catch(() => ({}));
          return response.ok
            ? { data: { path: body.$id }, error: null }
            : { data: null, error: body };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `${endpoint}/storage/buckets/${bucket}/files/${path}/view?project=${APPWRITE_CONFIG.projectId}`,
          },
        }),
        remove: async (paths: string[]) => {
          for (const path of paths)
            await fetch(`${endpoint}/storage/buckets/${bucket}/files/${path}`, {
              method: 'DELETE',
              headers: requestHeaders(undefined, sessionOverride, useApiKey),
            });
          return { error: null };
        },
      }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: async () => 'ok',
  };
  return client;
}

export function createClient(): AppwriteCompatClient {
  return createDataClient();
}

export function appwriteAdmin(): AppwriteCompatClient {
  return createDataClient();
}

export function getAdminClient(): AppwriteCompatClient {
  return createDataClient();
}
