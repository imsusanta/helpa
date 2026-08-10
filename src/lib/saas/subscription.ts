export async function checkPlanLimits(
  _accountId: string,
  _limitKey: 'max_users' | 'max_contacts' | 'max_ai_requests'
): Promise<boolean> {
  return true;
}

export async function incrementUsage(
  _accountId: string,
  _metric: 'ai_requests' | 'whatsapp_messages'
): Promise<void> {
  // no-op for now
}
