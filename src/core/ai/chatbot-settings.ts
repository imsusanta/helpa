/**
 * Account-level chatbot (AI auto-reply) master switch + response style.
 *
 * WHY system_settings and not an accounts column:
 * `triggerAiResponse` fetches the account row with `.single()` and NO
 * error fallback (src/lib/whatsapp/ai.ts). Adding a column to that select
 * would break AI replies for every account until a migration is applied.
 * Instead we mirror these settings into `system_settings` under
 * account-scoped keys — the exact pattern already used by
 * `src/app/api/account/ai/route.ts` for ai_system_prompt / welcome_message.
 * A missing row simply means "default" (enabled), so nothing breaks before
 * a workspace has ever configured the toggle.
 *
 * Account isolation: the settings key is ALWAYS derived from an
 * authenticated `accountId` resolved server-side (never from client input),
 * and every API route that reads/writes it is role-gated. The admin client
 * bypasses RLS the same way the existing account/ai route does.
 */
import { getAdminClient } from '@/lib/db/server';

export type ResponseStyle = 'concise' | 'balanced' | 'detailed';

export interface ChatbotSettings {
  /** Master switch for the inbound WhatsApp AI auto-reply. */
  enabled: boolean;
  /** How verbose AI-generated replies should be. */
  responseStyle: ResponseStyle;
}

export const DEFAULT_CHATBOT_SETTINGS: ChatbotSettings = {
  enabled: true,
  responseStyle: 'balanced',
};

const RESPONSE_STYLES: readonly ResponseStyle[] = [
  'concise',
  'balanced',
  'detailed',
];

type ChatbotDb = ReturnType<typeof getAdminClient>;

function settingKeys(accountId: string) {
  return {
    enabled: `account:${accountId}:ai_chatbot_enabled`,
    style: `account:${accountId}:ai_response_style`,
  };
}

/**
 * Read the chatbot master switch + response style for an account.
 * Never throws — defaults to enabled/balanced on any error or missing data.
 */
export async function getAccountChatbotSettings(
  accountId: string,
  db: ChatbotDb = getAdminClient()
): Promise<ChatbotSettings> {
  if (!accountId) return { ...DEFAULT_CHATBOT_SETTINGS };
  try {
    const keys = settingKeys(accountId);
    const { data } = await db
      .from('system_settings')
      .select('key, value')
      .in('key', [keys.enabled, keys.style]);

    let enabled = DEFAULT_CHATBOT_SETTINGS.enabled;
    let responseStyle: ResponseStyle = DEFAULT_CHATBOT_SETTINGS.responseStyle;

    if (Array.isArray(data)) {
      for (const row of data) {
        const value = String((row as { value?: unknown }).value ?? '');
        if (row.key === keys.enabled) {
          // Only an explicit "false" disables; anything else stays enabled.
          enabled = value !== 'false';
        } else if (
          row.key === keys.style &&
          RESPONSE_STYLES.includes(value as ResponseStyle)
        ) {
          responseStyle = value as ResponseStyle;
        }
      }
    }

    return { enabled, responseStyle };
  } catch (err) {
    console.warn(
      '[chatbot-settings] read failed; defaulting to enabled:',
      err instanceof Error ? err.message : err
    );
    return { ...DEFAULT_CHATBOT_SETTINGS };
  }
}

/**
 * Persist chatbot settings for an account (partial patch). Returns the
 * resulting merged settings. Best-effort — logs and returns the intended
 * state if the mirror write fails.
 */
export async function updateAccountChatbotSettings(
  accountId: string,
  patch: Partial<ChatbotSettings>,
  db: ChatbotDb = getAdminClient()
): Promise<ChatbotSettings> {
  const current = await getAccountChatbotSettings(accountId, db);
  const next: ChatbotSettings = {
    enabled:
      typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    responseStyle:
      patch.responseStyle && RESPONSE_STYLES.includes(patch.responseStyle)
        ? patch.responseStyle
        : current.responseStyle,
  };

  const keys = settingKeys(accountId);
  try {
    await db.from('system_settings').upsert(
      [
        { key: keys.enabled, value: String(next.enabled) },
        { key: keys.style, value: next.responseStyle },
      ],
      { onConflict: 'key' }
    );
  } catch (err) {
    console.warn(
      '[chatbot-settings] upsert failed:',
      err instanceof Error ? err.message : err
    );
  }

  return next;
}

/**
 * A short instruction appended to the AI system prompt to shape reply length.
 */
export function getResponseStyleInstruction(style: ResponseStyle): string {
  switch (style) {
    case 'concise':
      return 'Sound like a helpful human on WhatsApp: 1-2 short sentences, no filler.';
    case 'detailed':
      return 'Sound like a helpful human on WhatsApp: a bit more detail, still warm and spoken, with one clear next step.';
    case 'balanced':
    default:
      return 'Sound like a helpful human on WhatsApp: short, warm, and specific — not a brochure.';
  }
}
