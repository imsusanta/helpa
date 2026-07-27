import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Tenant-scoped wrapper around the Supabase service-role client.
 *
 * The service-role key bypasses RLS entirely, so every query made with it is
 * responsible for its own tenant isolation. Historically that was done by hand
 * and forgotten in ~66% of call sites. `scopedAdmin(accountId)` makes the
 * account filter the default instead of an afterthought:
 *
 *   const db = scopedAdmin(accountId)
 *   await db.from('appointments').select('*')   // .eq('account_id', accountId) injected
 *
 * Design rules:
 *  - Falsy accountId throws immediately (no "scope everything" fallback).
 *  - Unknown table names throw, so a newly added table fails closed until
 *    somebody classifies it here.
 *  - Tables without an account_id column cannot be silently scoped, so they
 *    are routed through explicit, deliberately verbose APIs (`fromChild`,
 *    `fromGlobal`) that document why they are safe.
 */

// ---------------------------------------------------------------------------
// Table classification. Derived from supabase/migrations/*.sql.
// ---------------------------------------------------------------------------

/** Tables carrying an `account_id` column: filter is injected automatically. */
const ACCOUNT_SCOPED_TABLES = new Set([
  'account_invitations',
  'appointments',
  'appointments_feedback',
  'automation_logs',
  'automation_pending_executions',
  'automations',
  'billing_invoices',
  'broadcasts',
  'coaching_admissions',
  'coaching_batches',
  'coaching_courses',
  'coaching_students',
  'contact_notes',
  'contacts',
  'conversations',
  'custom_fields',
  'deals',
  'flow_runs',
  'flows',
  'hospital_bills',
  'hospital_branch_staff',
  'hospital_branches',
  'hospital_doctors',
  'hospital_insurance',
  'hospital_lab_reports',
  'knowledge_base',
  'lab_reports',
  'message_templates',
  'patients',
  'pipelines',
  'profiles',
  'real_estate_properties',
  'real_estate_visits',
  'realestate_agents',
  'realestate_leads',
  'realestate_properties',
  'realestate_visits',
  'subscriptions',
  'tags',
  'tenant_modules',
  'travel_bookings',
  'travel_packages',
  'usage_tracking',
  'whatsapp_config',
])

/**
 * The tenant root. `accounts` has no `account_id`; its own `id` *is* the
 * account id, so the filter column differs.
 */
const TENANT_ROOT_TABLE = 'accounts'

/**
 * INTENTIONALLY GLOBAL — do not "fix" these by adding an account_id column.
 *
 * These two tables are cross-tenant by design and their lack of an account_id
 * is correct, not an oversight:
 *
 *  - `plans` is the public product/pricing catalogue. Every tenant sees the
 *    same plans; that is the point. Per-account plan rows would duplicate the
 *    catalogue per tenant and break plan comparison on the billing page.
 *  - `system_settings` is platform configuration, keyed by a TEXT primary key
 *    (`key`). It is operator-owned, not tenant-owned. Tenant-level preferences
 *    belong in `tenant_modules` / `whatsapp_config`, both of which DO carry an
 *    account_id.
 *
 * They are deliberately unreachable through `from()` and require the
 * explicitly-named `fromGlobal()` instead, so that reading across all tenants
 * is always a visible, intentional decision at the call site rather than a
 * forgotten filter. If you are here because a lint rule or a scoping audit
 * flagged these tables: they are flagged on purpose, and the answer is to
 * leave them alone.
 */
const GLOBAL_TABLES = new Set(['plans', 'system_settings'])

/**
 * Tables with no `account_id`, reachable only through a parent that has one.
 * Maps child table -> (foreign key column -> parent table). Every parent
 * listed here is a member of ACCOUNT_SCOPED_TABLES, so a single hop is
 * sufficient to prove tenancy.
 */
const CHILD_TABLE_PARENTS: Record<string, Record<string, string>> = {
  automation_steps: { automation_id: 'automations' },
  broadcast_recipients: { broadcast_id: 'broadcasts', contact_id: 'contacts' },
  contact_custom_values: { contact_id: 'contacts', custom_field_id: 'custom_fields' },
  contact_tags: { contact_id: 'contacts', tag_id: 'tags' },
  flow_nodes: { flow_id: 'flows' },
  flow_run_events: { flow_run_id: 'flow_runs' },
  // message_reactions.message_id -> messages is a second hop; conversation_id
  // reaches an account_id-bearing parent directly, so only it is allowed.
  message_reactions: { conversation_id: 'conversations' },
  messages: { conversation_id: 'conversations' },
  pipeline_stages: { pipeline_id: 'pipelines' },
}

// ---------------------------------------------------------------------------
// Underlying client
// ---------------------------------------------------------------------------

let _serviceRoleClient: SupabaseClient | null = null

/**
 * The one place in the codebase allowed to mint a service-role client.
 * Not exported: everything must go through `scopedAdmin()`.
 */
function serviceRoleClient(): SupabaseClient {
  if (!_serviceRoleClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('[scopedAdmin] NEXT_PUBLIC_SUPABASE_URL is not set')
    if (!key) throw new Error('[scopedAdmin] SUPABASE_SERVICE_ROLE_KEY is not set')
    _serviceRoleClient = createClient(url, key)
  }
  return _serviceRoleClient
}

type QueryBuilder = ReturnType<SupabaseClient['from']>
type Row = Record<string, unknown>
type Payload = Row | Row[]

// Each Postgrest verb returns a builder carrying its own HTTP method in the
// type, so they are not mutually assignable. Derive one alias per verb rather
// than forcing everything through the GET-shaped select() builder.
type SelectBuilder = ReturnType<QueryBuilder['select']>
type InsertBuilder = ReturnType<QueryBuilder['insert']>
type UpsertBuilder = ReturnType<QueryBuilder['upsert']>
type UpdateBuilder = ReturnType<QueryBuilder['update']>
type DeleteBuilder = ReturnType<QueryBuilder['delete']>

/** Thrown when a query cannot be proven to stay inside one account. */
export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TenantScopeError'
  }
}

/**
 * A `from()` result whose filters/payloads are pinned to one account.
 * Returns real Postgrest builders, so `.order()`, `.limit()`, `.single()`,
 * `.maybeSingle()` and friends keep working unchanged downstream.
 */
export interface ScopedTable {
  select(columns?: string, options?: Parameters<QueryBuilder['select']>[1]): SelectBuilder
  insert(values: Payload): InsertBuilder
  upsert(values: Payload, options?: Parameters<QueryBuilder['upsert']>[1]): UpsertBuilder
  update(values: Row): UpdateBuilder
  delete(): DeleteBuilder
}

function pinPayload(values: Payload, column: string, value: string): Payload {
  return Array.isArray(values)
    ? values.map((row) => ({ ...row, [column]: value }))
    : { ...values, [column]: value }
}

/**
 * Builds a ScopedTable that injects `column = value` on reads/mutations and
 * stamps the same pair onto inserted/upserted rows.
 */
function scopeTable(qb: QueryBuilder, column: string, value: string): ScopedTable {
  return {
    select: (columns, options) => qb.select(columns, options).eq(column, value) as SelectBuilder,
    // insert/upsert take the scope from the stamped payload, not a filter.
    insert: (values) => qb.insert(pinPayload(values, column, value)) as InsertBuilder,
    upsert: (values, options) =>
      qb.upsert(pinPayload(values, column, value), options) as UpsertBuilder,
    update: (values) => qb.update(values).eq(column, value) as UpdateBuilder,
    delete: () => qb.delete().eq(column, value) as DeleteBuilder,
  }
}

export interface ScopedAdminClient {
  /** The account every query issued through this instance is pinned to. */
  readonly accountId: string

  /** Query a table that has an `account_id` column, or `accounts` itself. */
  from(table: string): ScopedTable

  /**
   * Query a table with no `account_id`, pinned to a parent row this account
   * provably owns. Awaits the parent ownership check before returning a
   * builder, then pins the child query to that parent's foreign key.
   *
   *   const q = await db.fromChild('messages', 'conversation_id', conversationId)
   *   const { data } = await q.select('*')
   */
  fromChild(table: string, fkColumn: string, parentId: string): Promise<ScopedTable>

  /**
   * Escape hatch for the two genuinely cross-tenant tables (`plans`,
   * `system_settings`). Named so that any other use is obvious in review.
   */
  fromGlobal(table: string): QueryBuilder

  /**
   * Verify a row belongs to this account. Throws TenantScopeError otherwise.
   * Use before acting on any id that arrived from outside our own code.
   */
  assertOwns(table: string, id: string): Promise<void>

  /**
   * Service-role RPC passthrough. Postgres functions enforce their own
   * scoping, so callers must pass the account id in the args themselves.
   */
  rpc: SupabaseClient['rpc']
}

/**
 * Create a service-role client pinned to a single account.
 * @throws TenantScopeError when accountId is missing/blank.
 */
export function scopedAdmin(accountId: string | null | undefined): ScopedAdminClient {
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw new TenantScopeError(
      'scopedAdmin() requires a non-empty accountId; refusing to issue an unscoped service-role client',
    )
  }
  const id = accountId
  const client = serviceRoleClient()

  const assertOwns = async (table: string, rowId: string): Promise<void> => {
    if (!rowId) {
      throw new TenantScopeError(`assertOwns('${table}') called with an empty row id`)
    }
    const column = table === TENANT_ROOT_TABLE ? 'id' : 'account_id'
    if (table !== TENANT_ROOT_TABLE && !ACCOUNT_SCOPED_TABLES.has(table)) {
      throw new TenantScopeError(
        `assertOwns('${table}') is not supported: table has no account_id column`,
      )
    }
    const { data, error } = await client
      .from(table)
      .select('id')
      .eq('id', rowId)
      .eq(column, id)
      .maybeSingle()
    if (error) {
      throw new TenantScopeError(`ownership check on '${table}' failed: ${error.message}`)
    }
    if (!data) {
      // No row id / account id in the message: this can reach logs.
      throw new TenantScopeError(`row in '${table}' does not belong to the current account`)
    }
  }

  return {
    accountId: id,

    from(table: string): ScopedTable {
      if (ACCOUNT_SCOPED_TABLES.has(table)) {
        return scopeTable(client.from(table), 'account_id', id)
      }
      if (table === TENANT_ROOT_TABLE) {
        return scopeTable(client.from(table), 'id', id)
      }
      if (CHILD_TABLE_PARENTS[table]) {
        throw new TenantScopeError(
          `'${table}' has no account_id column; use fromChild('${table}', '<fk>', parentId) instead`,
        )
      }
      if (GLOBAL_TABLES.has(table)) {
        throw new TenantScopeError(
          `'${table}' is not tenant data; use fromGlobal('${table}') if that is intended`,
        )
      }
      throw new TenantScopeError(
        `unknown table '${table}': classify it in src/lib/supabase/scoped-admin.ts before querying it with the service role`,
      )
    },

    async fromChild(table: string, fkColumn: string, parentId: string): Promise<ScopedTable> {
      const parents = CHILD_TABLE_PARENTS[table]
      if (!parents) {
        throw new TenantScopeError(
          `fromChild('${table}') is not allowed: not a registered child table`,
        )
      }
      const parentTable = parents[fkColumn]
      if (!parentTable) {
        throw new TenantScopeError(
          `'${fkColumn}' is not an account-bearing parent of '${table}'; allowed: ${Object.keys(parents).join(', ')}`,
        )
      }
      await assertOwns(parentTable, parentId)
      return scopeTable(client.from(table), fkColumn, parentId)
    },

    fromGlobal(table: string): QueryBuilder {
      if (!GLOBAL_TABLES.has(table)) {
        throw new TenantScopeError(
          `fromGlobal('${table}') is not allowed: only ${[...GLOBAL_TABLES].join(', ')} are cross-tenant`,
        )
      }
      return client.from(table)
    },

    assertOwns,

    rpc: client.rpc.bind(client) as SupabaseClient['rpc'],
  }
}

/** Test seam: drop the memoised client so env changes take effect. */
export function __resetScopedAdminForTests(): void {
  _serviceRoleClient = null
}
