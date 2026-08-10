import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionSecret =
      cookieStore.get(`a_session_${APPWRITE_CONFIG.projectId}`)?.value ||
      cookieStore.get('appwrite_session')?.value;

    if (!sessionSecret) {
      return NextResponse.json(
        { success: false, user: null, error: 'No active session cookie' },
        { status: 401 }
      );
    }

    // Validate session with Appwrite account endpoint using session secret header
    const res = await fetch(`${APPWRITE_CONFIG.endpoint}/account`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        'X-Appwrite-Session': sessionSecret,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, user: null, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const appwriteUser = await res.json();

    return NextResponse.json({
      success: true,
      user: {
        id: appwriteUser.$id,
        email: appwriteUser.email,
        name: appwriteUser.name,
        created_at: appwriteUser.$createdAt,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        user: null,
        error: (err as Error).message || 'Failed to verify session',
      },
      { status: 500 }
    );
  }
}
