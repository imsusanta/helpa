/* eslint-disable */
import { getAppwriteClient } from '../../infrastructure/appwrite/client';

function createMockQuery(): any {
  const searchParams = new URLSearchParams();
  const mockUrl = {
    searchParams: {
      get(key: string) {
        return searchParams.get(key);
      },
    },
  };

  const query: any = {
    url: mockUrl,
    select() {
      return query;
    },
    eq(col: string, val: string) {
      searchParams.set(col, `eq.${val}`);
      return query;
    },
    neq(col: string, val: string) {
      searchParams.set(col, `neq.${val}`);
      return query;
    },
    ilike(col: string, val: string) {
      searchParams.set(col, `ilike.${val}`);
      return query;
    },
    in(col: string, vals: any[]) {
      searchParams.set(col, `in.(${vals.join(',')})`);
      return query;
    },
    or(val: string) {
      searchParams.set('or', val);
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    gte() {
      return query;
    },
    lte() {
      return query;
    },
    single() {
      return Promise.resolve({ data: null as any, error: null as any });
    },
    maybeSingle() {
      return Promise.resolve({ data: null as any, error: null as any });
    },
    insert() {
      return query;
    },
    update() {
      return query;
    },
    delete() {
      return query;
    },
    upsert() {
      return query;
    },
    then(onfulfilled: any) {
      return Promise.resolve({ data: [] as any[], error: null as any }).then(
        onfulfilled
      );
    },
  };
  return query;
}

export function createBrowserClient() {
  return createClient();
}

export function createClient(url?: string, key?: string, options?: any): any {
  const { account } = getAppwriteClient();

  const headers = options?.global?.headers || {};

  return {
    headers,
    auth: {
      async getSession() {
        try {
          const user = await account.get();
          return {
            data: { session: { user: { id: user.$id, email: user.email } } },
            error: null,
          };
        } catch {
          return { data: { session: null }, error: null };
        }
      },
      async getUser() {
        try {
          const user = await account.get();
          return {
            data: { user: { id: user.$id, email: user.email } },
            error: null,
          };
        } catch {
          return { data: { session: null }, error: null };
        }
      },
      onAuthStateChange(_callback: (_event: string, session: any) => void) {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        };
      },
      async signInWithPassword() {
        return { data: { session: null }, error: null };
      },
      async signOut() {
        try {
          await account.deleteSession('current');
        } catch {
          // ignore
        }
        return { error: null };
      },
    },
    from(_collectionName: string) {
      return createMockQuery();
    },
    rpc() {
      return Promise.resolve({ data: null as any, error: null as any });
    },
    channel(_channelName: string) {
      return {
        on() {
          return this;
        },
        subscribe(callback?: (status: string) => void) {
          if (callback) callback('SUBSCRIBED');
          return this;
        },
      };
    },
    removeChannel() {},
    storage: {
      from(_bucket: string) {
        return {
          async upload() {
            return { error: null };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: path } };
          },
          async remove() {
            return { error: null };
          },
        };
      },
    },
  };
}
