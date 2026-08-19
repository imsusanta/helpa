/**
 * Helpa Core Platform — Centralized Permissions
 *
 * Role-based permission registry and authorization guards.
 */

export type CoreRole = 'owner' | 'admin' | 'agent' | 'staff' | 'viewer';

export type CorePermission =
  | 'contacts.read'
  | 'contacts.write'
  | 'contacts.delete'
  | 'deals.read'
  | 'deals.write'
  | 'deals.delete'
  | 'pipelines.manage'
  | 'inbox.read'
  | 'inbox.reply'
  | 'inbox.assign'
  | 'ai.manage'
  | 'ai.reply'
  | 'knowledge.read'
  | 'knowledge.write'
  | 'campaigns.create'
  | 'campaigns.send'
  | 'automations.create'
  | 'automations.run'
  | 'flows.create'
  | 'flows.manage'
  | 'analytics.read'
  | 'audit.read'
  | 'team.invite'
  | 'team.manage'
  | 'settings.manage'
  | 'billing.manage';

export const ROLE_PERMISSIONS: Record<CoreRole, CorePermission[]> = {
  owner: [
    'contacts.read',
    'contacts.write',
    'contacts.delete',
    'deals.read',
    'deals.write',
    'deals.delete',
    'pipelines.manage',
    'inbox.read',
    'inbox.reply',
    'inbox.assign',
    'ai.manage',
    'ai.reply',
    'knowledge.read',
    'knowledge.write',
    'campaigns.create',
    'campaigns.send',
    'automations.create',
    'automations.run',
    'flows.create',
    'flows.manage',
    'analytics.read',
    'audit.read',
    'team.invite',
    'team.manage',
    'settings.manage',
    'billing.manage',
  ],
  admin: [
    'contacts.read',
    'contacts.write',
    'contacts.delete',
    'deals.read',
    'deals.write',
    'deals.delete',
    'pipelines.manage',
    'inbox.read',
    'inbox.reply',
    'inbox.assign',
    'ai.manage',
    'ai.reply',
    'knowledge.read',
    'knowledge.write',
    'campaigns.create',
    'campaigns.send',
    'automations.create',
    'automations.run',
    'flows.create',
    'flows.manage',
    'analytics.read',
    'audit.read',
    'team.invite',
    'team.manage',
    'settings.manage',
  ],
  agent: [
    'contacts.read',
    'contacts.write',
    'deals.read',
    'deals.write',
    'inbox.read',
    'inbox.reply',
    'inbox.assign',
    'knowledge.read',
    'analytics.read',
  ],
  staff: [
    'contacts.read',
    'contacts.write',
    'deals.read',
    'deals.write',
    'inbox.read',
    'inbox.reply',
    'inbox.assign',
    'knowledge.read',
    'analytics.read',
  ],
  viewer: [
    'contacts.read',
    'deals.read',
    'inbox.read',
    'knowledge.read',
    'analytics.read',
  ],
};

export function hasPermission(
  role: CoreRole | string,
  permission: CorePermission | string
): boolean {
  const normalizedRole = (role?.toLowerCase() || 'viewer') as CoreRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions.includes(permission as CorePermission);
}

export function assertPermission(
  role: CoreRole | string,
  permission: CorePermission | string
): void {
  if (!hasPermission(role, permission)) {
    throw new Error(
      `Permission denied: Role '${role}' lacks '${permission}' permission.`
    );
  }
}
