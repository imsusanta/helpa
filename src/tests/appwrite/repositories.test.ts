import { describe, it, expect } from 'vitest';
import { leadsRepository } from '@/infrastructure/appwrite/repositories/leads.repository';

describe('Appwrite Repositories Unit Tests', () => {
  it('instantiates leadsRepository cleanly', () => {
    expect(leadsRepository).toBeDefined();
    expect(typeof leadsRepository.listLeads).toBe('function');
    expect(typeof leadsRepository.updateStage).toBe('function');
  });
});
