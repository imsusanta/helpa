import { describe, expect, it } from 'vitest';

import {
  COPILOT_CONTACT_SELECT,
  COPILOT_CONVERSATION_SELECT,
  toCopilotContact,
} from './copilot-contact';

describe('copilot contact columns', () => {
  it('does not select a contacts.company column that production lacks', () => {
    expect(COPILOT_CONTACT_SELECT).not.toMatch(/(^|,\s*)company(\s*,|$)/);
    expect(COPILOT_CONVERSATION_SELECT).toContain(
      `contact:contacts(${COPILOT_CONTACT_SELECT})`
    );
    expect(COPILOT_CONTACT_SELECT).toContain('metadata');
  });

  it('maps optional company from contact metadata without requiring a column', () => {
    expect(
      toCopilotContact({
        id: 'c1',
        name: 'Ada',
        phone: '+1555',
        email: 'ada@example.test',
        metadata: { company: 'Helpa Clinic' },
      })
    ).toEqual({
      id: 'c1',
      name: 'Ada',
      phone: '+1555',
      email: 'ada@example.test',
      company: 'Helpa Clinic',
    });
  });

  it('returns null for a missing contact row', () => {
    expect(toCopilotContact(null)).toBeNull();
  });
});
