import { createHmac, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

const STATE_TTL_SECONDS = 10 * 60;

function getSecret() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error('META_APP_SECRET is not configured');
  return secret;
}

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const payload = `${ctx.accountId}:${ctx.userId}:${Date.now() + STATE_TTL_SECONDS * 1000}:${randomBytes(16).toString('hex')}`;
    const signature = createHmac('sha256', getSecret())
      .update(payload)
      .digest('hex');

    return NextResponse.json({
      state: `${Buffer.from(payload).toString('base64url')}.${signature}`,
    });
  } catch (error) {
    console.error(
      '[WhatsApp signup state]',
      error instanceof Error ? error.message : 'unknown'
    );
    return NextResponse.json(
      { error: 'Unable to start WhatsApp connection' },
      { status: 500 }
    );
  }
}
