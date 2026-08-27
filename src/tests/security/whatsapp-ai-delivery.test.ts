import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const metaSendSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'lib', 'automations', 'meta-send.ts'),
  'utf8'
);

describe('WhatsApp AI reply delivery invariants', () => {
  it('resolves outbound credentials from the canonical config table first', () => {
    const canonicalLookup = metaSendSource.indexOf(".from('whatsapp_configs')");
    const legacyLookup = metaSendSource.indexOf(".from('whatsapp_config')");

    expect(canonicalLookup).toBeGreaterThan(-1);
    expect(legacyLookup).toBeGreaterThan(canonicalLookup);
  });

  it('does not report a text reply as sent without Meta delivery evidence', () => {
    const textSender = metaSendSource.slice(
      metaSendSource.indexOf('export async function engineSendText'),
      metaSendSource.indexOf('export async function engineSendDocument')
    );
    const deliveryGuard = textSender.indexOf('if (!metaMessageId)');
    const persistence = textSender.indexOf('await recordSentMessage');

    expect(textSender).toContain('if (!creds)');
    expect(deliveryGuard).toBeGreaterThan(-1);
    expect(persistence).toBeGreaterThan(deliveryGuard);
  });

  it('persists AI WhatsApp replies through the inbox persist helper as bot', () => {
    expect(metaSendSource).toContain(
      "from '@/lib/whatsapp/persist-outbound-message'"
    );
    expect(metaSendSource).toContain('persistOutboundMessage');
    expect(metaSendSource).toContain("senderType: 'bot'");
    expect(metaSendSource).toContain('touchConversationPreview');
  });

  it('threads replyToMessageId and createdAt from AI sends into persist', () => {
    expect(metaSendSource).toContain(
      'replyToMessageId: extras?.replyToMessageId'
    );
    expect(metaSendSource).toContain('createdAt: extras?.createdAt');
    expect(metaSendSource).toContain('replyToMessageId: args.replyToMessageId');
    expect(metaSendSource).toContain('createdAt: args.createdAt');
  });
});
