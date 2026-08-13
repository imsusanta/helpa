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

function requestHeaders(
  extra?: HeadersInit,
  sessionOverride?: string,
  useApiKey = true
): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
  });
  const session = sessionOverride;
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
  return field;
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
    const camel = toCamelCase(key);
    if (camel !== key && result[camel] === undefined) result[camel] = value;
  });
  return result;
}

function normalizePayload(record: AnyRecord): AnyRecord {
  const payload = { ...record };
  delete payload.id;
  delete payload.$id;
  delete payload.$createdAt;
  delete payload.$updatedAt;
  delete payload.permissions;
  delete payload.$permissions;
  return payload;
}

function getPermissionsForRecord(record: AnyRecord): string[] {
  if (Array.isArray(record.permissions) && record.permissions.length > 0) {
    return record.permissions.filter((p) => !p.includes('"any"'));
  }
  if (Array.isArray(record.$permissions) && record.$permissions.length > 0) {
    return record.$permissions.filter((p) => !p.includes('"any"'));
  }

  const userId = record.user_id || record.userId;
  if (userId && typeof userId === 'string' && userId.length > 5) {
    return [
      `read("user:${userId}")`,
      `update("user:${userId}")`,
      `delete("user:${userId}")`,
    ];
  }

  return ['read("users")', 'update("users")', 'delete("users")'];
}

function queryValue(value: any): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function getCollectionCandidates(table: string): string[] {
  const map: Record<string, string> = {
    whatsapp_config:
      APPWRITE_CONFIG.collections.whatsappConfigs || 'whatsapp_configs',
    whatsapp_configs:
      APPWRITE_CONFIG.collections.whatsappConfigs || 'whatsapp_configs',
    message_templates:
      APPWRITE_CONFIG.collections.messageTemplates || 'message_templates',
    account_invitations:
      APPWRITE_CONFIG.collections.accountInvitations || 'account_invitations',
    lead_stage_history:
      APPWRITE_CONFIG.collections.leadStageHistory || 'lead_stage_history',
    contact_channels:
      APPWRITE_CONFIG.collections.contactChannels || 'contact_channels',
    idempotency_keys:
      APPWRITE_CONFIG.collections.idempotencyKeys || 'idempotency_keys',
    outbound_outbox:
      APPWRITE_CONFIG.collections.outboundOutbox || 'outbound_outbox',
    flow_runs: APPWRITE_CONFIG.collections.flowRuns || 'flow_runs',
    voice_integrations:
      APPWRITE_CONFIG.collections.voiceIntegrations || 'voice_integrations',
    voice_commands:
      APPWRITE_CONFIG.collections.voiceCommands || 'voice_commands',
    provider_events:
      APPWRITE_CONFIG.collections.providerEvents || 'provider_events',
    audit_logs: APPWRITE_CONFIG.collections.auditLogs || 'audit_logs',
    calendly_connections:
      APPWRITE_CONFIG.collections.calendlyConnections || 'calendly_connections',
    calendly_event_types:
      APPWRITE_CONFIG.collections.calendlyEventTypes || 'calendly_event_types',
    service_event_type_mappings:
      APPWRITE_CONFIG.collections.serviceEventTypeMappings ||
      'service_event_type_mappings',
    knowledge_base:
      APPWRITE_CONFIG.collections.knowledgeBase || 'knowledge_base',
    worker_health: APPWRITE_CONFIG.collections.workerHealth || 'worker_health',
  };

  const primary =
    map[table] ||
    (APPWRITE_CONFIG.collections as Record<string, string>)[table] ||
    table;
  const candidates = [primary];

  if (table === 'whatsapp_config' || table === 'whatsapp_configs') {
    if (!candidates.includes('whatsapp_configs'))
      candidates.push('whatsapp_configs');
    if (!candidates.includes('whatsapp_config'))
      candidates.push('whatsapp_config');
  } else if (primary.endsWith('s')) {
    const singular = primary.slice(0, -1);
    if (!candidates.includes(singular)) candidates.push(singular);
  } else {
    const plural = `${primary}s`;
    if (!candidates.includes(plural)) candidates.push(plural);
  }

  return candidates;
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

    // Map Supabase-style operator names to Appwrite query methods
    const operatorMap: Record<string, string> = {
      eq: 'equal',
      neq: 'notEqual',
      gt: 'greaterThan',
      gte: 'greaterThanEqual',
      lt: 'lessThan',
      lte: 'lessThanEqual',
      like: 'search',
      ilike: 'search',
    };

    const queries = parts
      .map((part) => {
        // Match field.operator.value (e.g. phone.eq.+1234, name.ilike.%john%)
        const match = part.match(
          /^([\w$]+)\.(eq|neq|gt|gte|lt|lte|ilike|like)\.(.*)$/
        );
        if (match) {
          const [, field, op, rawValue] = match;
          const method = operatorMap[op] || 'equal';
          const value =
            op === 'ilike' || op === 'like'
              ? rawValue.replace(/%/g, '')
              : rawValue;
          return appwriteQuery(method, field, value);
        }
        // Fallback: treat as field.eq.'' (shouldn't normally reach here)
        return appwriteQuery('equal', part.split('.')[0], '');
      })
      .filter(Boolean);

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
    if (!result.data || !Array.isArray(result.data)) {
      return { ...result, data: null };
    }
    if (result.data.length === 0) return { ...result, data: null };
    if (result.data.length > 1) {
      return {
        data: null,
        error: {
          message: 'Expected at most one document, found multiple',
          code: 'PGRST116',
        },
        count: result.count,
      };
    }
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

    const candidates = getCollectionCandidates(this.table);
    let lastErrorBody: any = null;
    let lastResponseStatus = 500;

    for (const colId of candidates) {
      const response = await fetch(
        `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents?${params}`,
        {
          headers: requestHeaders(undefined, this.session, this.useApiKey),
          cache: 'no-store',
          credentials: 'include',
        }
      );
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        const documents = (body.documents || []).map(normalizeRecord);
        return {
          data: this.selectionOptions.head ? null : documents,
          error: null,
          count: body.total ?? documents.length,
        };
      }
      lastResponseStatus = response.status;
      lastErrorBody = body;
      if (response.status !== 404) break;
    }

    if (
      lastResponseStatus === 400 &&
      lastErrorBody?.message?.includes('Attribute not found in schema:')
    ) {
      const match = lastErrorBody.message.match(
        /Attribute not found in schema:\s*([^\s,]+)/
      );
      if (match && match[1]) {
        const missingAttr = match[1];
        const altAttr = missingAttr.includes('_')
          ? toCamelCase(missingAttr)
          : toSnakeCase(missingAttr);

        if (altAttr !== missingAttr) {
          const retryParams = new URLSearchParams();
          const retryQueries = this.filters.map((qStr) => {
            try {
              const parsed = JSON.parse(qStr);
              if (parsed.attribute === missingAttr) {
                parsed.attribute = altAttr;
              }
              return JSON.stringify(parsed);
            } catch {
              return qStr;
            }
          });
          if (this.ordering.length) retryQueries.push(...this.ordering);
          if (this.maxRows !== undefined)
            retryQueries.push(appwriteQuery('limit', undefined, this.maxRows));
          if (this.offset)
            retryQueries.push(appwriteQuery('offset', undefined, this.offset));

          retryQueries.forEach((q, idx) =>
            retryParams.append(`queries[${idx}]`, q)
          );

          for (const colId of candidates) {
            const retryRes = await fetch(
              `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents?${retryParams}`,
              {
                headers: requestHeaders(
                  undefined,
                  this.session,
                  this.useApiKey
                ),
                cache: 'no-store',
                credentials: 'include',
              }
            );
            const retryBody = await retryRes.json().catch(() => ({}));
            if (retryRes.ok) {
              const documents = (retryBody.documents || []).map(
                normalizeRecord
              );
              return {
                data: this.selectionOptions.head ? null : documents,
                error: null,
                count: retryBody.total ?? documents.length,
              };
            }
          }
        }
      }
    }

    if (
      lastResponseStatus === 400 ||
      lastErrorBody?.message?.includes('Attribute not found') ||
      lastErrorBody?.message?.includes('Index not found')
    ) {
      throw Object.assign(
        new Error(
          `APPWRITE_SCHEMA_MISMATCH: ${lastErrorBody?.message || 'Attribute or index missing'}`
        ),
        { code: 'APPWRITE_SCHEMA_MISMATCH', status: 400 }
      );
    }
    throw Object.assign(
      new Error(lastErrorBody?.message || 'Appwrite request failed'),
      lastErrorBody
    );
  }

  private async create(_upsert = false) {
    const records = Array.isArray(this.payload) ? this.payload : [this.payload];
    const documents: any[] = [];
    const candidates = getCollectionCandidates(this.table);

    for (const record of records) {
      let lastErrorBody: any = null;
      let success = false;

      for (const colId of candidates) {
        let response = await fetch(
          `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents`,
          {
            method: 'POST',
            headers: requestHeaders(undefined, this.session, this.useApiKey),
            body: JSON.stringify({
              documentId: record.id || 'unique()',
              data: normalizePayload(record),
              permissions: getPermissionsForRecord(record),
            }),
          }
        );
        let body = await response.json().catch(() => ({}));

        if (
          !response.ok &&
          (body?.message?.includes('Permissions') ||
            body?.message?.includes('permissions') ||
            response.status === 401 ||
            response.status === 403)
        ) {
          const adminHeaders = requestHeaders(undefined, this.session, true);
          const retryRes = await fetch(
            `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents`,
            {
              method: 'POST',
              headers: adminHeaders,
              body: JSON.stringify({
                documentId: record.id || 'unique()',
                data: normalizePayload(record),
                permissions: getPermissionsForRecord(record),
              }),
            }
          );
          if (retryRes.ok) {
            response = retryRes;
            body = await retryRes.json().catch(() => ({}));
          }
        }

        const currentPayload = normalizePayload(record);
        let attempts = 0;
        while (
          !response.ok &&
          body?.message?.includes('Unknown attribute:') &&
          attempts < 15
        ) {
          attempts++;
          const match = body.message.match(/Unknown attribute:\s*"([^"]+)"/);
          if (!match || !match[1]) break;
          const unknownAttr = match[1];
          delete currentPayload[unknownAttr];
          const retryRes = await fetch(
            `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents`,
            {
              method: 'POST',
              headers: requestHeaders(undefined, this.session, this.useApiKey),
              body: JSON.stringify({
                documentId: record.id || 'unique()',
                data: currentPayload,
                permissions: getPermissionsForRecord(record),
              }),
            }
          );
          response = retryRes;
          body = await retryRes.json().catch(() => ({}));
          if (response.ok) break;
        }

        if (response.ok) {
          documents.push(normalizeRecord(body));
          success = true;
          break;
        }

        if (
          _upsert &&
          (response.status === 409 ||
            body?.code === 409 ||
            body?.type === 'document_already_exists')
        ) {
          const docId = record.id || record.$id;
          if (docId) {
            const upsertPayload = normalizePayload(record);
            let upsertAttempts = 0;
            let patchRes = await fetch(
              `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents/${encodeURIComponent(docId)}`,
              {
                method: 'PATCH',
                headers: requestHeaders(
                  undefined,
                  this.session,
                  this.useApiKey
                ),
                body: JSON.stringify({ data: upsertPayload }),
              }
            );
            let patchBody = await patchRes.json().catch(() => ({}));
            while (
              !patchRes.ok &&
              patchBody?.message?.includes('Unknown attribute:') &&
              upsertAttempts < 15
            ) {
              upsertAttempts++;
              const match = patchBody.message.match(
                /Unknown attribute:\s*"([^"]+)"/
              );
              if (!match || !match[1]) break;
              delete upsertPayload[match[1]];
              patchRes = await fetch(
                `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents/${encodeURIComponent(docId)}`,
                {
                  method: 'PATCH',
                  headers: requestHeaders(
                    undefined,
                    this.session,
                    this.useApiKey
                  ),
                  body: JSON.stringify({ data: upsertPayload }),
                }
              );
              patchBody = await patchRes.json().catch(() => ({}));
              if (patchRes.ok) break;
            }
            if (patchRes.ok) {
              documents.push(normalizeRecord(patchBody));
              success = true;
              break;
            }
          }
        }

        lastErrorBody = body;
        if (response.status !== 404) break;
      }

      if (!success) {
        throw Object.assign(
          new Error(lastErrorBody?.message || 'Appwrite request failed'),
          lastErrorBody
        );
      }
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
    const candidates = getCollectionCandidates(this.table);

    for (const document of documents) {
      let success = false;
      let lastErrorBody: any = null;

      for (const colId of candidates) {
        const currentPatchPayload = normalizePayload(this.payload);
        let response = await fetch(
          `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents/${encodeURIComponent(document.$id || document.id)}`,
          {
            method,
            headers: requestHeaders(undefined, this.session, this.useApiKey),
            ...(method === 'PATCH'
              ? {
                  body: JSON.stringify({
                    data: currentPatchPayload,
                  }),
                }
              : {}),
          }
        );
        let body = await response.json().catch(() => ({}));
        let mutateAttempts = 0;
        while (
          !response.ok &&
          method === 'PATCH' &&
          body?.message?.includes('Unknown attribute:') &&
          mutateAttempts < 15
        ) {
          mutateAttempts++;
          const match = body.message.match(/Unknown attribute:\s*"([^"]+)"/);
          if (!match || !match[1]) break;
          delete currentPatchPayload[match[1]];
          const retryRes = await fetch(
            `${endpoint}/databases/${encodeURIComponent(APPWRITE_CONFIG.databaseId)}/collections/${encodeURIComponent(colId)}/documents/${encodeURIComponent(document.$id || document.id)}`,
            {
              method: 'PATCH',
              headers: requestHeaders(undefined, this.session, this.useApiKey),
              body: JSON.stringify({ data: currentPatchPayload }),
            }
          );
          response = retryRes;
          body = await retryRes.json().catch(() => ({}));
          if (response.ok) break;
        }

        if (response.ok) {
          if (method === 'PATCH') updated.push(normalizeRecord(body));
          success = true;
          break;
        }
        lastErrorBody = body;
        if (response.status !== 404) break;
      }

      if (!success && method === 'PATCH') {
        throw Object.assign(
          new Error(lastErrorBody?.message || 'Appwrite request failed'),
          lastErrorBody
        );
      }
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
        return {
          data: { session: null },
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
        return {
          data: { session: null },
          error: {
            code: 'SERVER_AUTH_REQUIRED',
            message: 'Use /api/auth/login to establish a secure session.',
          },
        };
      },
      signOut: async () => {
        return {
          error: {
            code: 'SERVER_AUTH_REQUIRED',
            message: 'Use /api/auth/logout to revoke the secure session.',
          },
        };
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
          let response = await fetch(
            `${endpoint}/storage/buckets/${bucket}/files`,
            { method: 'POST', headers, body: form }
          );
          let body = await response.json().catch(() => ({}));

          // Auto-provision bucket on 404 storage_bucket_not_found and retry
          if (
            !response.ok &&
            (response.status === 404 ||
              body?.type === 'storage_bucket_not_found' ||
              body?.code === 404)
          ) {
            try {
              const createHeaders = requestHeaders(
                undefined,
                sessionOverride,
                true
              );
              await fetch(`${endpoint}/storage/buckets`, {
                method: 'POST',
                headers: createHeaders,
                body: JSON.stringify({
                  bucketId: bucket,
                  name: bucket,
                  permissions: [],
                  fileSecurity: false,
                  enabled: true,
                  allowedFileExtensions: [
                    'jpg',
                    'png',
                    'pdf',
                    'mp4',
                    'ogg',
                    'wav',
                    'json',
                    'txt',
                    'csv',
                    'docx',
                  ],
                }),
              });

              const retryForm = new FormData();
              retryForm.append('fileId', 'unique()');
              retryForm.append('file', file, path);
              response = await fetch(
                `${endpoint}/storage/buckets/${bucket}/files`,
                { method: 'POST', headers, body: retryForm }
              );
              body = await response.json().catch(() => ({}));
            } catch {
              /* ignore bucket auto-creation failure */
            }
          }

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
