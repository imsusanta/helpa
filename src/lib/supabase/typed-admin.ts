/* eslint-disable */
import 'server-only';

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

export function getAdminClient<T = any>(): any {
  return {
    from(_collectionName: string) {
      return createMockQuery();
    },
    rpc() {
      return Promise.resolve({ data: null as any, error: null as any });
    },
  };
}
