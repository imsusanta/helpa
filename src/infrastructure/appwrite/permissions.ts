import { Permission, Role } from 'node-appwrite';

export function createTenantPermissions(accountId: string) {
  const _teamRole = `team:${accountId}`;
  return [
    Permission.read(Role.team(accountId)),
    Permission.update(Role.team(accountId, 'owner')),
    Permission.update(Role.team(accountId, 'admin')),
    Permission.delete(Role.team(accountId, 'owner')),
  ];
}
