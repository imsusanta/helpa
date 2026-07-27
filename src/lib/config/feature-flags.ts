/**
 * Kill switches for subsystems that are reachable but not safe to run.
 *
 * Both flags below guard code that holds a service-role client and performs
 * no account_id filtering. Rather than half-fix it, we remove reachability:
 * an endpoint that cannot be called cannot leak. Each returns false unless
 * the env var is explicitly set to "true", so a missing or typo'd value
 * fails closed.
 */

/** True only for the exact string "true" — any other value stays off. */
function isEnabled(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true'
}

/**
 * `/api/mcp` and the MCP stdio server.
 *
 * The MCP tools in src/mcp/tools/ contain zero account_id filters, so any
 * authenticated caller would read across every tenant. Off until the tools
 * are scoped (Phase 1b).
 */
export function isMcpServerEnabled(): boolean {
  return isEnabled(process.env.ENABLE_MCP_SERVER)
}

/**
 * `/api/cron/campaigns`.
 *
 * The route read an `authorization` header into a variable and never compared
 * it, and its ~28 queries carry no account_id filter — it dispatches
 * broadcasts and sends documents across all tenants. Off until rewritten.
 */
export function isCampaignsCronEnabled(): boolean {
  return isEnabled(process.env.ENABLE_CAMPAIGNS_CRON)
}
