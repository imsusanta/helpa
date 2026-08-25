/**
 * Helpa Core Platform — Automations Engine
 *
 * Trigger -> Condition -> Action workflow engine for event-driven
 * messaging, tag updates, and team notifications.
 */

import { getAdminClient } from '@/lib/db/server';
import { coreEvents, CoreEvent } from '@/core/events';

export interface AutomationTrigger {
  type: string;
  config?: Record<string, unknown>;
}

export interface AutomationAction {
  type: 'send_whatsapp' | 'add_tag' | 'assign_user' | 'notify_team';
  config: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  account_id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  actions?: AutomationAction[];
}

export async function executeAutomationsForEvent(
  event: CoreEvent
): Promise<void> {
  const db = getAdminClient();

  const { data: rules } = await db
    .from('automations')
    .select('*')
    .eq('account_id', event.accountId)
    .eq('is_active', true)
    .eq('trigger_type', event.type);

  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    try {
      await coreEvents.emit('automation.triggered', event.accountId, {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerEvent: event.type,
      });
      // Additional action dispatching is performed through the steps tree
    } catch (err) {
      console.error(`[Automations] Error running rule ${rule.id}:`, err);
    }
  }
}
