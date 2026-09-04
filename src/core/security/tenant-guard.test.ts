import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordSecurityEvent } = vi.hoisted(() => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock('./security-events', () => ({ recordSecurityEvent }));

import { assertTenantOwnership, validateWorkspaceContext } from './tenant-guard';

describe('tenant guard coverage', () => {
  beforeEach(() => {
    recordSecurityEvent.mockReset();
  });

  it('fails closed when either workspace context is missing', async () => {
    await expect(
      assertTenantOwnership({
        authorizedWorkspaceId: '',
        resourceWorkspaceId: 'tenant-b',
        resourceType: 'contact',
        resourceId: 'contact-1',
      })
    ).rejects.toThrow('Workspace authorization context missing');

    await expect(
      assertTenantOwnership({
        authorizedWorkspaceId: 'tenant-a',
        resourceWorkspaceId: '',
        resourceType: 'contact',
        resourceId: 'contact-1',
      })
    ).rejects.toThrow('Workspace authorization context missing');
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it('allows ownership within the authenticated workspace', async () => {
    await expect(
      assertTenantOwnership({
        authorizedWorkspaceId: 'tenant-a',
        resourceWorkspaceId: 'tenant-a',
        resourceType: 'contact',
        resourceId: 'contact-1',
      })
    ).resolves.toBe(true);
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it('records and rejects cross-tenant access', async () => {
    await expect(
      assertTenantOwnership({
        authorizedWorkspaceId: 'tenant-a',
        resourceWorkspaceId: 'tenant-b',
        resourceType: 'contact',
        resourceId: 'contact-1',
      })
    ).rejects.toThrow('Resource does not belong to your workspace');

    expect(recordSecurityEvent).toHaveBeenCalledWith({
      type: 'tenant.cross_access_attempt',
      severity: 'high',
      attemptedWorkspaceId: 'tenant-a',
      targetResourceId: 'contact-1',
      resourceType: 'contact',
      metadata: {
        attemptedByWorkspace: 'tenant-a',
        targetResourceOwnerWorkspace: 'tenant-b',
      },
    });
  });

  it('uses the authenticated workspace when no client value is supplied', () => {
    expect(validateWorkspaceContext('tenant-a')).toBe('tenant-a');
    expect(validateWorkspaceContext('tenant-a', null)).toBe('tenant-a');
  });

  it('accepts a matching client workspace and rejects tampering', () => {
    expect(validateWorkspaceContext('tenant-a', 'tenant-a')).toBe('tenant-a');
    expect(() => validateWorkspaceContext('tenant-a', 'tenant-b')).toThrow(
      'Client workspace parameter does not match authenticated workspace'
    );
  });
});
