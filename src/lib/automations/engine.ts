import type {
  Automation,
  AutomationLogStepResult,
  AutomationStep,
  AutomationTriggerType,
  ConditionStepConfig,
  KeywordMatchTriggerConfig,
  SendMessageStepConfig,
  SendTemplateStepConfig,
  SendWebhookStepConfig,
  TagStepConfig,
  TagTriggerConfig,
  UpdateContactFieldStepConfig,
  WaitStepConfig,
  CreateDealStepConfig,
  AssignConversationStepConfig,
} from '@/types';
import { appwriteAdmin } from '@/lib/appwrite-server-compat';
import { engineSendText, engineSendTemplate } from './meta-send';

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export interface AutomationContext {
  /** Raw message text, for keyword_match + message_content conditions. */
  message_text?: string;
  /** Conversation the event belongs to, if any. */
  conversation_id?: string;
  /** Arbitrary variables accumulated during execution. */
  vars?: Record<string, unknown>;
  /** The tag id that was added, for tag_added trigger. */
  tag_id?: string;
  /** Agent the conversation was assigned to, for conversation_assigned. */
  agent_id?: string;
}

export interface DispatchInput {
  /** Account-level tenancy key. Drives the lookup of which active
   *  automations to fire — `automations.account_id` is the tenant
   *  isolation after migration 017. Replaces the previous `userId`
   *  field; the per-automation user_id is read off each row when
   *  needed (sender identity for outbound messages, log audit). */
  accountId: string;
  triggerType: AutomationTriggerType;
  contactId?: string | null;
  context?: AutomationContext;
}

/**
 * Fire all active automations matching the given trigger for an
 * account.
 *
 * Must never throw — callers use fire-and-forget from the webhook.
 * All errors are caught and logged; per-automation failures are
 * recorded into automation_logs with status='failed'.
 */
export async function runAutomationsForTrigger(
  input: DispatchInput
): Promise<{ replied: boolean; executedCount: number }> {
  let replied = false;
  let executedCount = 0;
  try {
    const db = appwriteAdmin();

    // Tenant isolation. `contactId` can be caller-supplied (the manual
    // POST /api/automations/engine entrypoint reads it straight from the
    // request body), and every step below runs through the service-role
    // client, which bypasses RLS. So before any step can touch the
    // contact, verify it actually belongs to this account. A foreign or
    // forged id is refused silently — callers are fire-and-forget, and a
    // distinct error would leak whether a given contact UUID exists.
    if (input.contactId) {
      const { data: owned, error: ownErr } = await db
        .from('contacts')
        .select('id')
        .eq('id', input.contactId)
        .eq('account_id', input.accountId)
        .maybeSingle();
      if (ownErr) {
        console.error('[automations] contact ownership check failed:', ownErr);
        return { replied: false, executedCount: 0 };
      }
      if (!owned) {
        console.warn(
          '[automations] contact not in account, refusing dispatch',
          input.contactId
        );
        return { replied: false, executedCount: 0 };
      }
    }

    const { data: automations, error } = await db
      .from('automations')
      .select('*')
      .eq('account_id', input.accountId)
      .eq('trigger_type', input.triggerType)
      .eq('is_active', true);

    if (error) {
      console.error('[automations] fetch failed:', error);
      return { replied: false, executedCount: 0 };
    }
    if (!automations || automations.length === 0) {
      return { replied: false, executedCount: 0 };
    }

    for (const automation of automations as Automation[]) {
      if (!triggerMatches(automation, input.context)) continue;
      try {
        const res = await executeAutomation(automation, input);
        executedCount++;
        if (res?.replied) {
          replied = true;
        }
      } catch (err) {
        console.error('[automations] execute failed:', automation.id, err);
      }
    }
  } catch (err) {
    console.error('[automations] dispatch failed:', err);
  }
  return { replied, executedCount };
}

/**
 * Resume a run that was parked at a wait step. Called from the cron
 * endpoint after it grabs a due `automation_pending_executions` row.
 */
export async function resumePendingExecution(pending: {
  id: string;
  automation_id: string;
  /** Audit-only; the automation row carries account_id for tenancy. */
  user_id: string;
  /** Account-scoped lookups read from the automation row, so this
   *  field is just here to mirror the row shape and keep the cron's
   *  pass-through self-documenting. */
  account_id: string;
  contact_id: string | null;
  log_id: string | null;
  parent_step_id: string | null;
  branch: 'yes' | 'no' | null;
  next_step_position: number;
  context: AutomationContext;
}): Promise<void> {
  const db = appwriteAdmin();
  const { data: automation, error } = await db
    .from('automations')
    .select('*')
    .eq('id', pending.automation_id)
    .single();

  if (error || !automation) {
    console.error(
      '[automations] resume: missing automation',
      pending.automation_id,
      error
    );
    await markPending(pending.id, 'failed');
    return;
  }

  try {
    await executeStepsFrom({
      automation: automation as Automation,
      contactId: pending.contact_id,
      context: pending.context ?? {},
      parentStepId: pending.parent_step_id,
      branch: pending.branch,
      startPosition: pending.next_step_position,
      logId: pending.log_id,
      triggerEvent: 'resumed_wait',
      contactCache: {},
    });
    await markPending(pending.id, 'done');
  } catch (err) {
    console.error('[automations] resume failed:', err);
    await markPending(pending.id, 'failed');
  }
}

// ------------------------------------------------------------
// Internal execution
// ------------------------------------------------------------

async function executeAutomation(
  automation: Automation,
  input: DispatchInput
): Promise<{ replied: boolean }> {
  const db = appwriteAdmin();

  const { data: log, error: logErr } = await db
    .from('automation_logs')
    .insert({
      automation_id: automation.id,
      // Tenancy: matches automation.account_id (NOT NULL post-017).
      account_id: automation.account_id,
      // Audit: keeps the historical "author of this automation"
      // pointer so logs still attribute to the right user even
      // after teammates join the account.
      user_id: automation.user_id,
      contact_id: input.contactId ?? null,
      trigger_event: input.triggerType,
      steps_executed: [],
      status: 'success',
    })
    .select()
    .single();

  if (logErr || !log) {
    console.error('[automations] cannot create log:', logErr);
    return { replied: false };
  }

  const { replied } = await executeStepsFrom({
    automation,
    contactId: input.contactId ?? null,
    context: input.context ?? {},
    parentStepId: null,
    branch: null,
    startPosition: 0,
    logId: log.id,
    triggerEvent: input.triggerType,
    contactCache: {},
  });

  // Atomic counter update via the SQL function from migration 007.
  // Doing this with a client-side read-modify-write raced when the
  // same automation fired for two contacts simultaneously — both
  // would read N and both write N+1, losing one count permanently.
  const { error: rpcErr } = await db.rpc(
    'increment_automation_execution_count',
    {
      p_automation_id: automation.id,
    }
  );
  if (rpcErr) {
    console.error('[automations] increment counter failed:', rpcErr);
  }

  return { replied };
}

/** Minimal contact projection used by `{{ contact.* }}` tokens. */
interface ContactSnapshot {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
}

/**
 * Per-run memo for the contact row. Shared by reference across nested
 * branch scopes (they're built with `{ ...args }`), so a five-step
 * automation that mentions `{{ contact.name }}` in every message still
 * reads the contact exactly once.
 */
interface ContactCache {
  promise?: Promise<ContactSnapshot | null>;
}

interface ExecuteArgs {
  automation: Automation;
  contactId: string | null;
  context: AutomationContext;
  parentStepId: string | null;
  branch: 'yes' | 'no' | null;
  startPosition: number;
  logId: string | null;
  triggerEvent: string;
  contactCache: ContactCache;
}

async function executeStepsFrom(
  args: ExecuteArgs
): Promise<{ replied: boolean }> {
  let replied = false;
  const db = appwriteAdmin();

  const baseQuery = db
    .from('automation_steps')
    .select('*')
    .eq('automation_id', args.automation.id)
    .gte('position', args.startPosition)
    .order('position', { ascending: true });

  const scoped =
    args.parentStepId === null
      ? baseQuery.is('parent_step_id', null)
      : baseQuery
          .eq('parent_step_id', args.parentStepId)
          .eq('branch', args.branch ?? 'yes');

  const { data: steps, error: stepsErr } = await scoped;

  if (stepsErr) {
    await finalizeLog(args.logId, 'failed', stepsErr.message);
    return { replied: false };
  }
  if (!steps || steps.length === 0) {
    if (args.parentStepId === null && args.logId) {
      await finalizeLog(args.logId, 'success', null);
    }
    return { replied: false };
  }

  const results: AutomationLogStepResult[] = [];
  let status: 'success' | 'partial' | 'failed' = 'success';
  let errorMessage: string | null = null;

  for (const step of steps as AutomationStep[]) {
    // `wait` is the suspension point: enqueue and stop processing this
    // scope. The cron endpoint will pick it up later.
    if (step.step_type === 'wait') {
      const cfg = step.step_config as WaitStepConfig;
      const ms = waitMs(cfg);
      await db.from('automation_pending_executions').insert({
        automation_id: args.automation.id,
        // Tenancy: account_id required NOT NULL post-017.
        account_id: args.automation.account_id,
        user_id: args.automation.user_id,
        contact_id: args.contactId,
        log_id: args.logId,
        parent_step_id: args.parentStepId,
        branch: args.branch,
        next_step_position: step.position + 1,
        context: args.context,
        run_at: new Date(Date.now() + ms).toISOString(),
        status: 'pending',
      });
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'success',
        detail: `waiting ${cfg.amount} ${cfg.unit}`,
      });
      status = 'partial';
      await appendResults(args.logId, results, status, errorMessage);
      return { replied };
    }

    try {
      if (step.step_type === 'condition') {
        const cfg = step.step_config as ConditionStepConfig;
        const taken = await evaluateCondition(cfg, args);
        results.push({
          step_id: step.id,
          step_type: 'condition',
          status: 'success',
          detail: `branch=${taken ? 'yes' : 'no'}`,
        });
        // Recurse into the chosen branch at position 0 (children use their
        // own ordering within the branch scope).
        const branchRes = await executeStepsFrom({
          ...args,
          parentStepId: step.id,
          branch: taken ? 'yes' : 'no',
          startPosition: 0,
          logId: args.logId,
        });
        if (branchRes?.replied) {
          replied = true;
        }
        continue;
      }

      const detail = await runStep(step, args);
      if (
        step.step_type === 'send_message' ||
        step.step_type === 'send_template'
      ) {
        replied = true;
      }
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'success',
        detail,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        step_id: step.id,
        step_type: step.step_type,
        status: 'failed',
        detail: msg,
      });
      status = 'failed';
      errorMessage = msg;
      break;
    }
  }

  if (args.parentStepId === null) {
    await appendResults(args.logId, results, status, errorMessage);
  } else {
    // Nested branch — just append results; parent scope decides final status.
    await appendResults(args.logId, results, null, errorMessage);
  }

  return { replied };
}

async function runStep(
  step: AutomationStep,
  args: ExecuteArgs
): Promise<string> {
  const db = appwriteAdmin();

  switch (step.step_type) {
    case 'send_message': {
      const cfg = step.step_config as SendMessageStepConfig;
      if (!args.contactId) throw new Error('send_message needs a contact');
      const text = await interpolate(cfg.text, args);
      if (!text.trim()) throw new Error('send_message has empty text');
      const conversationId = await resolveConversationId(args);
      const { whatsapp_message_id } = await engineSendText({
        accountId: args.automation.account_id,
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        text,
      });
      return `sent via Meta (${whatsapp_message_id})`;
    }

    case 'send_template': {
      const cfg = step.step_config as SendTemplateStepConfig;
      if (!args.contactId) throw new Error('send_template needs a contact');
      if (!cfg.template_name)
        throw new Error('send_template needs template_name');
      const conversationId = await resolveConversationId(args);
      // Meta templates use positional numbered placeholders, so we MUST
      // emit params in strict numeric order. Lexicographic sort of
      // "1", "2", …, "10" yields "1", "10", "2", … which silently
      // scrambles every template with ≥10 variables.
      const keys = cfg.variables
        ? Object.keys(cfg.variables).sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            const aNum = Number.isFinite(na);
            const bNum = Number.isFinite(nb);
            if (aNum && bNum) return na - nb;
            if (aNum) return -1;
            if (bNum) return 1;
            return a.localeCompare(b);
          })
        : [];
      // Template variables go through the same token resolution as message
      // text, so a reminder template can carry {{ appointment.time }}.
      const params: string[] = [];
      for (const k of keys) {
        params.push(await interpolate(String(cfg.variables![k]), args));
      }
      const { whatsapp_message_id } = await engineSendTemplate({
        accountId: args.automation.account_id,
        userId: args.automation.user_id,
        conversationId,
        contactId: args.contactId,
        templateName: cfg.template_name,
        language: cfg.language,
        params,
      });
      return `template sent via Meta (${whatsapp_message_id})`;
    }

    case 'add_tag': {
      // contact_tags has no account_id column; cross-tenant protection for
      // the attacker-supplied contactId comes from the ownership guard in
      // runAutomationsForTrigger.
      const cfg = step.step_config as TagStepConfig;
      if (!args.contactId || !cfg.tag_id)
        throw new Error('add_tag needs contact + tag_id');
      await db
        .from('contact_tags')
        .upsert(
          { contact_id: args.contactId, tag_id: cfg.tag_id },
          { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
        );
      return `tag ${cfg.tag_id} added`;
    }

    case 'remove_tag': {
      // See add_tag: tenant scoping relies on the runAutomationsForTrigger
      // ownership guard, since contact_tags carries no account_id.
      const cfg = step.step_config as TagStepConfig;
      if (!args.contactId || !cfg.tag_id)
        throw new Error('remove_tag needs contact + tag_id');
      await db
        .from('contact_tags')
        .delete()
        .eq('contact_id', args.contactId)
        .eq('tag_id', cfg.tag_id);
      return `tag ${cfg.tag_id} removed`;
    }

    case 'assign_conversation': {
      const cfg = step.step_config as AssignConversationStepConfig;
      if (!args.contactId)
        throw new Error('assign_conversation needs a contact');
      let agentId = cfg.agent_id;
      if (cfg.mode === 'round_robin') {
        agentId = await resolveRoundRobinAgent(args.automation.account_id);
      }
      if (!agentId) return 'no agent resolved';
      await db
        .from('conversations')
        .update({ assigned_agent_id: agentId })
        .eq('account_id', args.automation.account_id)
        .eq('contact_id', args.contactId);
      return `assigned to ${agentId}`;
    }

    case 'update_contact_field': {
      const cfg = step.step_config as UpdateContactFieldStepConfig;
      if (!args.contactId)
        throw new Error('update_contact_field needs a contact');
      // Resolve workflow variables ({{ vars.* }}, {{ message.text }}) so custom
      // values can be populated dynamically from the triggering context.
      const value = await interpolate(cfg.value, args);

      // Custom fields are encoded as `custom:<custom_field_id>`; anything else
      // is a built-in contact column.
      if (cfg.field.startsWith('custom:')) {
        const customFieldId = cfg.field.slice('custom:'.length);
        if (!customFieldId) {
          return `field ${cfg.field} not writable from automations`;
        }
        // Defense in depth: the service-role client bypasses RLS, so confirm
        // the field definition belongs to this account before writing.
        const { data: field } = await db
          .from('custom_fields')
          .select('id')
          .eq('id', customFieldId)
          .eq('account_id', args.automation.account_id)
          .maybeSingle();
        if (!field) {
          return `field ${cfg.field} not writable from automations`;
        }
        // Upsert on the table's UNIQUE(contact_id, custom_field_id) so repeated
        // runs overwrite rather than duplicate. Tenancy is enforced above and,
        // for the contact side, by the entry-point ownership guard.
        await db.from('contact_custom_values').upsert(
          {
            contact_id: args.contactId,
            custom_field_id: customFieldId,
            value,
          },
          { onConflict: 'contact_id,custom_field_id' }
        );
        return `custom field updated`;
      }

      const allowed = new Set(['name', 'email', 'company']);
      if (!allowed.has(cfg.field)) {
        return `field ${cfg.field} not writable from automations`;
      }
      // Defense in depth: scope the service-role write to the account so
      // a future caller that skips the entry-point ownership guard still
      // cannot write across tenants.
      await db
        .from('contacts')
        .update({ [cfg.field]: value, updated_at: new Date().toISOString() })
        .eq('id', args.contactId)
        .eq('account_id', args.automation.account_id);
      return `${cfg.field} updated`;
    }

    case 'create_deal': {
      const cfg = step.step_config as CreateDealStepConfig;
      if (!cfg.pipeline_id || !cfg.stage_id)
        throw new Error('create_deal needs pipeline + stage');
      // Match the account's configured default currency rather than
      // the static `deals.currency` DB default — keeps automation-
      // created deals consistent with the one-currency-per-account
      // rule (issue #218). Fall back to USD if the row is somehow
      // missing the value (pre-021 forks).
      const { data: acct } = await db
        .from('accounts')
        .select('default_currency')
        .eq('id', args.automation.account_id)
        .maybeSingle();
      await db.from('deals').insert({
        // Tenancy + audit, same split as automation_logs above.
        account_id: args.automation.account_id,
        user_id: args.automation.user_id,
        pipeline_id: cfg.pipeline_id,
        stage_id: cfg.stage_id,
        contact_id: args.contactId,
        title: await interpolate(cfg.title, args),
        value: cfg.value ?? 0,
        currency: acct?.default_currency ?? 'USD',
        status: 'open',
      });
      return 'deal created';
    }

    case 'send_webhook': {
      const cfg = step.step_config as SendWebhookStepConfig;
      if (!cfg.url) throw new Error('send_webhook needs url');
      // Validate BEFORE building the body: no point interpolating (and
      // potentially loading the contact) for a target we will refuse.
      const target = assertSafeWebhookUrl(cfg.url);
      const body = cfg.body_template
        ? await interpolate(cfg.body_template, args)
        : JSON.stringify(args.context);
      const sent = await postWebhook(target, body, cfg.headers);
      return sent.attempts > 1
        ? `webhook ${sent.status} (after ${sent.attempts} attempts)`
        : `webhook ${sent.status}`;
    }

    case 'close_conversation': {
      if (!args.contactId)
        throw new Error('close_conversation needs a contact');
      await db
        .from('conversations')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('account_id', args.automation.account_id)
        .eq('contact_id', args.contactId);
      return 'conversation closed';
    }

    default:
      return `unknown step: ${step.step_type}`;
  }
}

// ------------------------------------------------------------
// Assignment
// ------------------------------------------------------------

/** Viewers are read-only, so they never receive a conversation. */
const NON_ASSIGNABLE_ROLES = new Set(['viewer']);

interface RoundRobinMember {
  user_id: string;
  account_role?: string | null;
}

interface ConversationLoadRow {
  assigned_agent_id?: string | null;
  status?: string | null;
  updated_at?: string | null;
}

/**
 * Pick the next agent for a round-robin assignment.
 *
 * The previous implementation took `profiles ... .limit(1)`, i.e. the
 * same person every single time — "round-robin" in the UI, a single
 * point of overload in practice.
 *
 * There is no assignment ledger to rotate through, so we derive the
 * rotation from the conversations themselves: fewest currently-open
 * conversations wins, ties go to whoever has gone longest without an
 * assignment, and a final user_id comparison keeps two concurrent runs
 * from disagreeing. Because each assignment immediately raises that
 * agent's open count, consecutive triggers fan out across the team.
 */
async function resolveRoundRobinAgent(
  accountId: string
): Promise<string | undefined> {
  const db = appwriteAdmin();

  const { data: memberRows } = await db
    .from('profiles')
    .select('user_id, account_role')
    .eq('account_id', accountId)
    .order('user_id', { ascending: true });

  const pool = ((memberRows as RoundRobinMember[] | null) ?? []).filter(
    (m) =>
      !!m?.user_id && !NON_ASSIGNABLE_ROLES.has(String(m.account_role ?? ''))
  );
  if (pool.length === 0) return undefined;
  if (pool.length === 1) return pool[0].user_id;

  const { data: conversationRows } = await db
    .from('conversations')
    .select('assigned_agent_id, status, updated_at')
    .eq('account_id', accountId);

  const openLoad = new Map<string, number>();
  const lastAssignedAt = new Map<string, number>();
  for (const member of pool) {
    openLoad.set(member.user_id, 0);
    lastAssignedAt.set(member.user_id, 0);
  }

  for (const row of (conversationRows as ConversationLoadRow[] | null) ?? []) {
    const agent = row?.assigned_agent_id;
    if (!agent || !openLoad.has(agent)) continue;
    if (row.status !== 'closed') {
      openLoad.set(agent, (openLoad.get(agent) ?? 0) + 1);
    }
    const touchedAt = row.updated_at ? Date.parse(row.updated_at) : NaN;
    if (Number.isFinite(touchedAt)) {
      lastAssignedAt.set(
        agent,
        Math.max(lastAssignedAt.get(agent) ?? 0, touchedAt)
      );
    }
  }

  let best = pool[0].user_id;
  for (const member of pool) {
    const candidate = member.user_id;
    if (candidate === best) continue;
    const candidateLoad = openLoad.get(candidate) ?? 0;
    const bestLoad = openLoad.get(best) ?? 0;
    if (candidateLoad !== bestLoad) {
      if (candidateLoad < bestLoad) best = candidate;
      continue;
    }
    const candidateSeen = lastAssignedAt.get(candidate) ?? 0;
    const bestSeen = lastAssignedAt.get(best) ?? 0;
    if (candidateSeen !== bestSeen) {
      if (candidateSeen < bestSeen) best = candidate;
      continue;
    }
    if (candidate < best) best = candidate;
  }
  return best;
}

// ------------------------------------------------------------
// Webhooks
// ------------------------------------------------------------

const WEBHOOK_MAX_ATTEMPTS = 3;

/**
 * Hostnames that must never be reachable from a customer-authored
 * webhook step. `send_webhook` runs server-side with no egress
 * restrictions, so without this an automation is a request-forgery
 * primitive pointed at the cloud metadata service or anything else on
 * the private network.
 *
 * This is a literal-host check only. A hostname that *resolves* to a
 * private address still gets through; blocking that needs DNS
 * resolution plus a pinned-IP fetch, which is tracked separately.
 */
const BLOCKED_WEBHOOK_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

function webhookTimeoutMs(): number {
  const configured = Number(process.env.AUTOMATION_WEBHOOK_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 10_000;
}

function webhookRetryDelayMs(attempt: number): number {
  const configured = Number(process.env.AUTOMATION_WEBHOOK_RETRY_BASE_MS);
  const base =
    Number.isFinite(configured) && configured >= 0 ? configured : 500;
  return base * 2 ** (attempt - 1);
}

function isPrivateAddress(host: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true;
    const head = host.split(':')[0];
    if (/^f[cd]/.test(head)) return true; // unique-local
    if (/^fe[89ab]/.test(head)) return true; // link-local
    return false;
  }
  return false;
}

function assertSafeWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('send_webhook url is not a valid absolute URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `send_webhook only supports http(s), got ${url.protocol.replace(':', '')}`
    );
  }
  const host = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  const blocked =
    BLOCKED_WEBHOOK_HOSTS.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    isPrivateAddress(host);
  if (blocked) {
    throw new Error(`send_webhook refused internal host ${url.hostname}`);
  }
  return url;
}

type WebhookAttempt =
  | { outcome: 'ok'; status: number }
  | { outcome: 'retry'; message: string }
  | { outcome: 'fatal'; message: string };

async function attemptWebhook(
  url: URL,
  body: string,
  headers?: Record<string, string>
): Promise<WebhookAttempt> {
  const controller = new AbortController();
  const timeout = webhookTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(headers ?? {}) },
      body,
      // Not following redirects keeps the host check above meaningful —
      // otherwise a public endpoint could 302 us straight at 169.254.169.254.
      redirect: 'manual',
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      return {
        outcome: 'fatal',
        message: `webhook redirected (${res.status}); redirects are not followed`,
      };
    }
    if (res.ok) return { outcome: 'ok', status: res.status };
    // 429 and 5xx are the only statuses worth trying again.
    if (res.status === 429 || res.status >= 500) {
      return { outcome: 'retry', message: `webhook returned ${res.status}` };
    }
    return { outcome: 'fatal', message: `webhook returned ${res.status}` };
  } catch (err) {
    if (controller.signal.aborted) {
      return {
        outcome: 'retry',
        message: `webhook timed out after ${timeout}ms`,
      };
    }
    return {
      outcome: 'retry',
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function postWebhook(
  url: URL,
  body: string,
  headers?: Record<string, string>
): Promise<{ status: number; attempts: number }> {
  let lastMessage = 'webhook failed';
  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
    const result = await attemptWebhook(url, body, headers);
    if (result.outcome === 'ok') {
      return { status: result.status, attempts: attempt };
    }
    if (result.outcome === 'fatal') {
      throw new Error(result.message);
    }
    lastMessage = result.message;
    if (attempt < WEBHOOK_MAX_ATTEMPTS) {
      await sleep(webhookRetryDelayMs(attempt));
    }
  }
  throw new Error(`${lastMessage} (${WEBHOOK_MAX_ATTEMPTS} attempts)`);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Pick the conversation a send-type step should use. Prefer the id the
 * webhook handed us (it's the one that just got the inbound message);
 * fall back to the contact's most recent conversation for resumed/wait
 * paths and manual engine POSTs. Throws if none exists — send steps
 * have no meaningful target without a conversation.
 *
 * Deliberately not `.maybeSingle()`: a contact can legitimately have
 * more than one conversation row, and maybeSingle turns that into a
 * hard error that fails the whole automation.
 */
async function resolveConversationId(args: ExecuteArgs): Promise<string> {
  const fromCtx = args.context.conversation_id;
  if (fromCtx) return fromCtx;
  if (!args.contactId)
    throw new Error('cannot resolve conversation: no contact');
  const { data, error } = await appwriteAdmin()
    .from('conversations')
    .select('id')
    .eq('account_id', args.automation.account_id)
    .eq('contact_id', args.contactId)
    .order('last_message_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`conversation lookup failed: ${error.message}`);
  const conversationId = (data as { id?: string }[] | null)?.[0]?.id;
  if (!conversationId) throw new Error('no conversation for contact');
  return conversationId;
}

/**
 * Decide whether an active automation actually applies to this event.
 *
 * The dispatch query already filters by account + trigger_type +
 * is_active, so this is the per-trigger config check. Everything that
 * isn't listed here has no configurable narrowing and always matches.
 */
function triggerMatches(
  automation: Automation,
  ctx: AutomationContext | undefined
): boolean {
  switch (automation.trigger_type) {
    case 'keyword_match': {
      const cfg = automation.trigger_config as KeywordMatchTriggerConfig;
      if (!cfg?.keywords || cfg.keywords.length === 0) return false;
      const text = (ctx?.message_text ?? '').toString();
      if (!text) return false;
      const haystack = cfg.case_sensitive ? text : text.toLowerCase();
      return cfg.keywords.some((raw) => {
        const k = cfg.case_sensitive ? raw : raw.toLowerCase();
        return cfg.match_type === 'exact'
          ? haystack === k
          : haystack.includes(k);
      });
    }

    case 'tag_added': {
      // Previously unfiltered: a "when the VIP tag is added" automation
      // fired for every tag on every contact. An automation with no
      // tag_id can't express intent, so it stays silent rather than
      // matching everything (activation validation requires one anyway).
      const cfg = automation.trigger_config as TagTriggerConfig;
      if (!cfg?.tag_id) return false;
      return !!ctx?.tag_id && ctx.tag_id === cfg.tag_id;
    }

    case 'conversation_assigned': {
      // Optional narrowing: no agent_id means "assigned to anyone",
      // which is a legitimate configuration, so that still matches.
      const cfg = automation.trigger_config as { agent_id?: string };
      if (!cfg?.agent_id) return true;
      return ctx?.agent_id === cfg.agent_id;
    }

    default:
      return true;
  }
}

async function evaluateCondition(
  cfg: ConditionStepConfig,
  args: ExecuteArgs
): Promise<boolean> {
  const db = appwriteAdmin();
  switch (cfg.subject) {
    case 'tag_presence': {
      if (!args.contactId || !cfg.operand) return false;
      // contact_tags has no account_id column (its RLS keys off the parent
      // contact), so tenant scoping here relies on the contact-ownership
      // guard in runAutomationsForTrigger.
      const { count } = await db
        .from('contact_tags')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', args.contactId)
        .eq('tag_id', cfg.operand);
      return (count ?? 0) > 0;
    }
    case 'contact_field': {
      if (!args.contactId || !cfg.operand) return false;
      // Scope to the account so the condition can't be turned into a
      // cross-tenant read oracle via the service-role client.
      const { data } = await db
        .from('contacts')
        .select(cfg.operand)
        .eq('id', args.contactId)
        .eq('account_id', args.automation.account_id)
        .maybeSingle();
      const v = (data as Record<string, unknown> | null)?.[cfg.operand];
      return v != null && String(v) === String(cfg.value ?? '');
    }
    case 'message_content': {
      const text = (args.context.message_text ?? '').toString();
      return text.toLowerCase().includes((cfg.value ?? '').toLowerCase());
    }
    case 'time_of_day': {
      // operand form "HH:mm-HH:mm" — true if now is within that window
      // (supports over-midnight ranges like "18:00-09:00").
      const [from, to] = (cfg.operand ?? '').split('-');
      if (!from || !to) return false;
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const parse = (s: string) => {
        const [h, m] = s.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const f = parse(from);
      const t = parse(to);
      return f <= t ? mins >= f && mins < t : mins >= f || mins < t;
    }
    default:
      return false;
  }
}

function waitMs(cfg: WaitStepConfig): number {
  const unitMs =
    cfg.unit === 'days'
      ? 86_400_000
      : cfg.unit === 'hours'
        ? 3_600_000
        : 60_000;
  return Math.max(1_000, cfg.amount * unitMs);
}

// ------------------------------------------------------------
// Token interpolation
// ------------------------------------------------------------

const TOKEN_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function stringifyToken(value: unknown): string {
  return value == null ? '' : String(value);
}

/** "2026-08-25" → "25 Aug 2026". Parsed by hand so the value never
 *  shifts a day because of the server's timezone. */
function formatAppointmentDate(value: unknown): string {
  const raw = stringifyToken(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  const month = MONTH_LABELS[Number(m[2]) - 1];
  if (!month) return raw;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** "14:30" or "14:30:00" → "2:30 PM". */
function formatAppointmentTime(value: unknown): string {
  const raw = stringifyToken(value);
  const m = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!m) return raw;
  const hours = Number(m[1]);
  if (!Number.isFinite(hours) || hours > 23) return raw;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${m[2]} ${suffix}`;
}

/** Loads the contact once per run, and only when a token needs it. */
async function loadContactSnapshot(
  args: ExecuteArgs
): Promise<ContactSnapshot | null> {
  if (!args.contactId) return null;
  if (!args.contactCache.promise) {
    args.contactCache.promise = appwriteAdmin()
      .from('contacts')
      .select('name, phone, email, company')
      .eq('id', args.contactId)
      .eq('account_id', args.automation.account_id)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => (data as ContactSnapshot) ?? null)
      .catch(() => null);
  }
  return (await args.contactCache.promise) ?? null;
}

function resolveToken(
  key: string,
  args: ExecuteArgs,
  contact: ContactSnapshot | null
): string {
  const [namespace, ...rest] = key.split('.');
  const prop = rest.join('.');
  const vars = args.context.vars ?? {};

  switch (namespace) {
    case 'message':
      return prop === 'text' ? stringifyToken(args.context.message_text) : '';

    case 'vars':
      return prop ? stringifyToken(vars[prop]) : '';

    case 'contact': {
      if (!contact) return '';
      switch (prop) {
        case 'name':
          return stringifyToken(contact.name);
        case 'first_name': {
          const full = stringifyToken(contact.name).trim();
          return full ? full.split(/\s+/)[0] : '';
        }
        case 'phone':
          return stringifyToken(contact.phone);
        case 'email':
          return stringifyToken(contact.email);
        case 'company':
          return stringifyToken(contact.company);
        default:
          return '';
      }
    }

    case 'appointment': {
      // The appointment routes and the reminder scheduler both push these
      // into context.vars, so this namespace is a friendlier alias over
      // vars.appointment_* with display formatting applied.
      switch (prop) {
        case 'date':
          return formatAppointmentDate(vars.appointment_date);
        case 'date_iso':
          return stringifyToken(vars.appointment_date);
        case 'time':
          return formatAppointmentTime(vars.appointment_time);
        case 'time_24h':
          return stringifyToken(vars.appointment_time);
        case 'id':
          return stringifyToken(vars.appointment_id);
        case 'booking_id':
          return stringifyToken(vars.booking_id);
        default:
          return stringifyToken(vars[`appointment_${prop}`]);
      }
    }

    default:
      return '';
  }
}

/**
 * Replace `{{ token }}` placeholders in step text.
 *
 * Supported: `message.text`, `vars.<key>`, `contact.name|first_name|
 * phone|email|company`, and `appointment.date|time|date_iso|time_24h|
 * id|booking_id`. Unknown tokens resolve to an empty string, which is
 * the long-standing behaviour — a half-rendered `{{ contact.nmae }}`
 * in a customer's WhatsApp message is worse than a gap.
 */
async function interpolate(s: string, args: ExecuteArgs): Promise<string> {
  const template = s ?? '';
  if (!template.includes('{{')) return template;
  const contact = template.includes('contact.')
    ? await loadContactSnapshot(args)
    : null;
  return template.replace(TOKEN_PATTERN, (_, key) =>
    resolveToken(String(key), args, contact)
  );
}

async function appendResults(
  logId: string | null,
  newItems: AutomationLogStepResult[],
  status: 'success' | 'partial' | 'failed' | null,
  errorMessage: string | null
) {
  if (!logId) return;
  const db = appwriteAdmin();
  // NOTE: read-modify-write. Two branches of the same run never execute
  // concurrently, so this is safe today, but a future parallel-branch
  // executor would need a jsonb append in SQL instead.
  const { data: existing } = await db
    .from('automation_logs')
    .select('steps_executed, status')
    .eq('id', logId)
    .single();
  const merged = [
    ...((existing?.steps_executed as AutomationLogStepResult[] | undefined) ??
      []),
    ...newItems,
  ];
  const update: Record<string, unknown> = { steps_executed: merged };
  // Only overwrite status on the outermost scope — nested branches pass null.
  if (status !== null) {
    update.status = status;
  }
  if (errorMessage) update.error_message = errorMessage;
  await db.from('automation_logs').update(update).eq('id', logId);
}

async function finalizeLog(
  logId: string | null,
  status: 'success' | 'partial' | 'failed',
  errorMessage: string | null
) {
  if (!logId) return;
  await appwriteAdmin()
    .from('automation_logs')
    .update({ status, error_message: errorMessage })
    .eq('id', logId);
}

async function markPending(id: string, status: 'done' | 'failed') {
  await appwriteAdmin()
    .from('automation_pending_executions')
    .update({ status })
    .eq('id', id);
}
