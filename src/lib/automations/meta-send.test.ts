import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appwriteAdmin: vi.fn(),
  decrypt: vi.fn(),
  sendTextMessage: vi.fn(),
  createMessage: vi.fn(),
}));

vi.mock('@/lib/appwrite-server-compat', () => ({
  appwriteAdmin: mocks.appwriteAdmin,
}));

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: mocks.decrypt,
}));

vi.mock('@/lib/whatsapp/meta-api', () => ({
  sendTextMessage: mocks.sendTextMessage,
  sendMediaMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  sendInteractiveButtons: vi.fn(),
}));

vi.mock('@/infrastructure/appwrite/repositories/messages.repository', () => ({
  messagesRepository: {
    createMessage: mocks.createMessage,
  },
}));

import { engineSendText } from './meta-send';

function query(data: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

describe('automation WhatsApp delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decrypt.mockReturnValue('meta-access-token');
    mocks.sendTextMessage.mockResolvedValue({ messageId: 'wamid.patient-1' });
    mocks.createMessage.mockResolvedValue({ $id: 'local-message-1' });

    const configQuery = query({
      phone_number_id: 'phone-number-1',
      encrypted_access_token: 'encrypted-token',
    });
    const contactQuery = query({ phone: '+91 9876543210' });

    mocks.appwriteAdmin.mockReturnValue({
      from: vi.fn((table: string) =>
        table === 'whatsapp_configs' ? configQuery : contactQuery
      ),
    });
  });

  it('sends the patient message through Meta before recording it locally', async () => {
    const result = await engineSendText({
      accountId: 'account-1',
      userId: 'user-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      text: 'Your appointment is confirmed.',
    });

    expect(mocks.decrypt).toHaveBeenCalledWith('encrypted-token');
    expect(mocks.sendTextMessage).toHaveBeenCalledWith({
      phoneNumberId: 'phone-number-1',
      accessToken: 'meta-access-token',
      to: '919876543210',
      text: 'Your appointment is confirmed.',
    });
    expect(mocks.createMessage).toHaveBeenCalledWith('account-1', {
      conversationId: 'conversation-1',
      senderType: 'agent',
      senderId: 'user-1',
      content: 'Your appointment is confirmed.',
      mediaUrl: undefined,
      status: 'sent',
      providerMessageId: 'wamid.patient-1',
    });
    expect(result).toEqual({ whatsapp_message_id: 'wamid.patient-1' });
  });

  it('fails clearly when the clinic has no WhatsApp configuration', async () => {
    const missingConfigQuery = query(null);
    mocks.appwriteAdmin.mockReturnValue({
      from: vi.fn(() => missingConfigQuery),
    });

    await expect(
      engineSendText({
        accountId: 'account-1',
        userId: 'user-1',
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        text: 'Test',
      })
    ).rejects.toThrow(/WhatsApp is not configured/);

    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });
});
