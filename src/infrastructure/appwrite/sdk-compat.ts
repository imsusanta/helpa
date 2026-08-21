type QueryDescriptor = {
  kind: 'equal' | 'order' | 'limit' | 'offset' | 'search';
  field?: string;
  value?: unknown;
  ascending?: boolean;
};

export const ID = {
  unique: () => crypto.randomUUID(),
};

export const Query = {
  equal: (field: string, value: unknown): QueryDescriptor => ({
    kind: 'equal',
    field,
    value,
  }),
  orderAsc: (field: string): QueryDescriptor => ({
    kind: 'order',
    field,
    ascending: true,
  }),
  orderDesc: (field: string): QueryDescriptor => ({
    kind: 'order',
    field,
    ascending: false,
  }),
  limit: (value: number): QueryDescriptor => ({ kind: 'limit', value }),
  offset: (value: number): QueryDescriptor => ({ kind: 'offset', value }),
  search: (field: string, value: string): QueryDescriptor => ({
    kind: 'search',
    field,
    value,
  }),
};

export const Permission = {
  read: () => '',
  update: () => '',
  delete: () => '',
};

export const Role = {
  team: (id: string, role?: string) => `${id}:${role || 'member'}`,
};

export type { QueryDescriptor };
