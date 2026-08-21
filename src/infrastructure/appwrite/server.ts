/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAdminClient } from '@/lib/supabase/server';
import type { QueryDescriptor } from './sdk-compat';

function snakeCase(value: string): string {
  if (value === '$createdAt') return 'created_at';
  if (value === '$updatedAt') return 'updated_at';
  if (value === '$id') return 'id';
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}

function toRow(document: Record<string, any>) {
  const row: Record<string, any> = {};
  for (const [key, value] of Object.entries(document)) {
    if (key.startsWith('$') || key === 'permissions') continue;
    row[snakeCase(key)] = value;
  }
  return row;
}

function fromRow(row: Record<string, any>) {
  const document: Record<string, any> = { ...row };
  for (const [key, value] of Object.entries(row)) {
    document[camelCase(key)] ??= value;
  }
  document.$id = row.id;
  document.$createdAt = row.created_at;
  document.$updatedAt = row.updated_at;
  return document;
}

function databaseAdapter() {
  const client = getAdminClient();
  return {
    async listDocuments(
      _databaseId: string,
      table: string,
      descriptors: QueryDescriptor[] = []
    ) {
      let query: any = client.from(table).select('*', { count: 'exact' });
      let limit = 100;
      let offset = 0;
      for (const descriptor of descriptors) {
        const field = descriptor.field ? snakeCase(descriptor.field) : '';
        if (descriptor.kind === 'equal') {
          query = Array.isArray(descriptor.value)
            ? query.in(field, descriptor.value)
            : query.eq(field, descriptor.value);
        }
        if (descriptor.kind === 'lessThan')
          query = query.lt(field, descriptor.value);
        if (descriptor.kind === 'search')
          query = query.ilike(field, `%${String(descriptor.value || '')}%`);
        if (descriptor.kind === 'order')
          query = query.order(field, { ascending: descriptor.ascending });
        if (descriptor.kind === 'limit') limit = Number(descriptor.value);
        if (descriptor.kind === 'offset') offset = Number(descriptor.value);
      }
      query = query.range(offset, offset + Math.max(0, limit - 1));
      const { data, error, count } = await query;
      if (error) throw error;
      return {
        documents: (data || []).map(fromRow),
        total: count ?? data?.length ?? 0,
      };
    },

    async getDocument(_databaseId: string, table: string, id: string) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return fromRow(data);
    },

    async createDocument(
      _databaseId: string,
      table: string,
      documentId: string,
      payload: Record<string, any>,
      _permissions?: string[]
    ) {
      const row = toRow(payload);
      if (documentId && documentId !== 'unique()') row.id = documentId;
      const { data, error } = await client
        .from(table)
        .insert(row)
        .select('*')
        .single();
      if (error) throw error;
      return fromRow(data);
    },

    async updateDocument(
      _databaseId: string,
      table: string,
      id: string,
      payload: Record<string, any>
    ) {
      const { data, error } = await client
        .from(table)
        .update(toRow(payload))
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return fromRow(data);
    },

    async deleteDocument(_databaseId: string, table: string, id: string) {
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function storageAdapter() {
  const client = getAdminClient();
  return {
    async createFile(
      bucket: string,
      fileId: string,
      input: { data: Buffer | Uint8Array; filename?: string }
    ) {
      const { error } = await client.storage
        .from(bucket)
        .upload(fileId, input.data, { upsert: false });
      if (error) throw error;
      return { $id: fileId, name: input.filename || fileId };
    },
    async getFileDownload(bucket: string, fileId: string) {
      const { data, error } = await client.storage.from(bucket).download(fileId);
      if (error) throw error;
      return data.arrayBuffer();
    },
    async deleteFile(bucket: string, fileId: string) {
      const { error } = await client.storage.from(bucket).remove([fileId]);
      if (error) throw error;
    },
  };
}

export function getAppwriteAdminClient() {
  const supabase = getAdminClient();
  return {
    client: supabase,
    account: supabase.auth.admin,
    databases: databaseAdapter(),
    storage: storageAdapter(),
    users: supabase.auth.admin,
    teams: {
      create: async (id: string, name: string) => ({ $id: id, name }),
    },
  };
}
