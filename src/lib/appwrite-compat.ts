/**
 * Stub compatibility layer for files still using Supabase query syntax.
 *
 * This does NOT hit a real database — it returns empty results so the
 * app can compile and boot. Each call site must be migrated to an
 * Appwrite repository before it becomes production-ready.
 *
 * WARNING: This file exists ONLY to unblock the build. It must be
 * deleted once every consumer is migrated to Appwrite repositories.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StubError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export type PostgrestError = StubError;
export type SupabaseClient = StubClient;

export interface StubResult {
  data: any;
  error: StubError | null;
  count: number | null;
}

interface StubQueryBuilder {
  select: (..._args: any[]) => StubQueryBuilder;
  insert: (..._args: any[]) => StubQueryBuilder;
  update: (..._args: any[]) => StubQueryBuilder;
  upsert: (..._args: any[]) => StubQueryBuilder;
  delete: (..._args: any[]) => StubQueryBuilder;
  eq: (..._args: any[]) => StubQueryBuilder;
  neq: (..._args: any[]) => StubQueryBuilder;
  gt: (..._args: any[]) => StubQueryBuilder;
  gte: (..._args: any[]) => StubQueryBuilder;
  lt: (..._args: any[]) => StubQueryBuilder;
  lte: (..._args: any[]) => StubQueryBuilder;
  in: (..._args: any[]) => StubQueryBuilder;
  is: (..._args: any[]) => StubQueryBuilder;
  ilike: (..._args: any[]) => StubQueryBuilder;
  like: (..._args: any[]) => StubQueryBuilder;
  contains: (..._args: any[]) => StubQueryBuilder;
  containedBy: (..._args: any[]) => StubQueryBuilder;
  order: (..._args: any[]) => StubQueryBuilder;
  limit: (..._args: any[]) => StubQueryBuilder;
  range: (..._args: any[]) => StubQueryBuilder;
  single: () => Promise<StubResult>;
  maybeSingle: () => Promise<StubResult>;
  then: (resolve: (val: StubResult) => void) => Promise<void>;
  csv: () => StubQueryBuilder;
  textSearch: (..._args: any[]) => StubQueryBuilder;
  not: (..._args: any[]) => StubQueryBuilder;
  or: (..._args: any[]) => StubQueryBuilder;
  filter: (..._args: any[]) => StubQueryBuilder;
  match: (..._args: any[]) => StubQueryBuilder;
}

function createStubQueryBuilder(): StubQueryBuilder {
  const result: StubResult = { data: [] as any, error: null, count: 0 };
  const builder: StubQueryBuilder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    in: () => builder,
    is: () => builder,
    ilike: () => builder,
    like: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: () => Promise.resolve({ data: {} as any, error: null, count: 1 }),
    maybeSingle: () =>
      Promise.resolve({ data: {} as any, error: null, count: 1 }),
    then: (resolve) => Promise.resolve(resolve(result)),
    csv: () => builder,
    textSearch: () => builder,
    not: () => builder,
    or: () => builder,
    filter: () => builder,
    match: () => builder,
  };
  return builder;
}

interface StubClient {
  from: (_table: string) => StubQueryBuilder;
  rpc: (_fn: string, _params?: Record<string, unknown>) => Promise<StubResult>;
  channel: (_name: string) => any;
  removeChannel: (_ch: any) => void;
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email: string } | null };
      error: null;
    }>;
    signOut: (_opts?: Record<string, unknown>) => Promise<{ error: null }>;
    signInWithPassword: (
      _creds: Record<string, string>
    ) => Promise<{ data: { session: null }; error: null }>;
    getSession: () => Promise<{
      data: { session: { user: { id: string; email: string } } | null };
      error: null;
    }>;
    updateUser: (
      _attributes: Record<string, unknown>
    ) => Promise<{ data: { user: null }; error: null }>;
  };
  storage: {
    from: (_bucket: string) => {
      upload: (
        _path: string,
        _file: unknown,
        _opts?: Record<string, unknown>
      ) => Promise<{ data: { path: string }; error: null }>;
      getPublicUrl: (_path: string) => { data: { publicUrl: string } };
      remove: (_paths: string[]) => Promise<{ error: null }>;
    };
  };
}

function createStubClient(): StubClient {
  return {
    from: (_table: string) => createStubQueryBuilder(),
    rpc: (_fn: string) =>
      Promise.resolve({ data: null, error: null, count: null }),
    channel: () => {
      const ch: any = {
        on: () => ch,
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: () => {},
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: 'admin_user_id', email: 'admin@clinic.com' } },
          error: null,
        }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              user: { id: 'admin_user_id', email: 'admin@clinic.com' },
            },
          },
          error: null,
        }),
      updateUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    storage: {
      from: (_bucket: string) => ({
        upload: (_path: string) =>
          Promise.resolve({ data: { path: _path }, error: null }),
        getPublicUrl: (_path: string) => ({
          data: { publicUrl: `https://stub/${_path}` },
        }),
        remove: () => Promise.resolve({ error: null }),
      }),
    },
  };
}

/**
 * Drop-in replacement for the deleted `supabaseAdmin()` function.
 * Returns a stub client that compiles but returns empty data.
 */
export function supabaseAdmin(): StubClient {
  return createStubClient();
}

/**
 * Drop-in replacement for the deleted `getAdminClient()` function.
 */
export function getAdminClient(): StubClient {
  return createStubClient();
}

/**
 * Drop-in replacement for the deleted `createClient()` function.
 */
export function createClient(): StubClient {
  return createStubClient();
}
