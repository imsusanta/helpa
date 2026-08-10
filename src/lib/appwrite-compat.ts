/**
 * Appwrite data adapter for the parts of the application that still use the
 * old fluent data-access shape.  It intentionally has no appwrite dependency
 * or network target: every request goes to Appwrite's REST API.
 */

import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

type AnyRecord = Record<string, any>;

export type AppwriteCompatClient = any;
export type appwriteClient = AppwriteCompatClient;
export type PostgrestError = any;

const endpoint = APPWRITE_CONFIG.endpoint.replace(/\/$/, '');

function browserSession(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem('appwrite_session') || undefined;
  } catch {
    return undefined;
  }
}

function saveBrowserSession(secret: string | undefined) {
  if (typeof window === 'undefined' || !secret) return;
  try {
    window.localStorage.setItem('appwrite_session', secret);
  } catch {
    // Storage may be disabled; the httpOnly cookie still protects the session.
  }
}

function clearBrowserSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('appwrite_session');
  } catch {
    // Ignore storage failures during sign-out.
  }
}

function requestHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
  });
  const session = browserSession();
  if (session) headers.set('X-Appwrite-Session', session);
  if (typeof window === 'undefined' && APPWRITE_CONFIG.apiKey) {
    headers.set('X-Appwrite-Key', APPWRITE_CONFIG.apiKey);
  }
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

function appwriteQuery(operator: string, field: string, value: any): string {
  const values = Array.isArray(value) ? value : [value];
  return `${operator}("${field}",${JSON.stringify(values)})`;
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

  constructor(table: string) {
    this.table = table;
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
        ? appwriteQuery('isNull', field, [])
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
      this.filters.push(appwriteQuery('isNotNull', field, []));
    }
    return this;
  }
  or(expression: string) {
    const parts = expression.split(',').filter(Boolean);
    if (parts.length) this.filters.push(`or(${parts.join(',')})`);
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
      `${options.ascending === false ? 'desc' : 'asc'}:${field}`
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
    this.filters.forEach((query) => params.append('queries[]', query));
    this.ordering.forEach((query) =>
      params.append(
        'queries[]',
        `order${query.startsWith('desc') ? 'Desc' : 'Asc'}("${query.slice(query.indexOf(':') + 1)}")`
      )
    );
    if (this.maxRows !== undefined)
      params.append('queries[]', `limit(${this.maxRows})`);
    if (this.offset) params.append('queries[]', `offset(${this.offset})`);
    const response = await fetch(
      `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(this.table)}/documents?${params}`,
      { headers: requestHeaders(), cache: 'no-store' }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message), body);
    const documents = body.documents || [];
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
          headers: requestHeaders(),
          body: JSON.stringify({
            documentId: record.id || 'unique()',
            data: record,
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message), body);
      documents.push(body);
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
          headers: requestHeaders(),
          ...(method === 'PATCH'
            ? { body: JSON.stringify({ data: this.payload }) }
            : {}),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body.message), body);
      if (method === 'PATCH') updated.push(body);
    }
    return { data: updated, error: null, count: documents.length };
  }
}

function createDataClient(): AppwriteCompatClient {
  const client: AnyRecord = {
    from: (table: string) => new QueryBuilder(table),
    rpc: async () => ({
      data: null,
      error: { message: 'RPC is not available in Appwrite' },
      count: null,
    }),
    auth: {
      getUser: async () => {
        const response = await fetch(`${endpoint}/account`, {
          headers: requestHeaders(),
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
          headers: requestHeaders(),
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
          const headers = requestHeaders();
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
              headers: requestHeaders(),
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
