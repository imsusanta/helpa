import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'This WhatsApp connection endpoint has been replaced. Use the secure Embedded Signup flow.',
      code: 'USE_SECURE_EMBEDDED_SIGNUP',
    },
    { status: 410 }
  );
}
