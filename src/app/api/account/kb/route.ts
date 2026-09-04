import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

const VALID_CATEGORIES = ['faq', 'service', 'pricing', 'policy', 'company'];

function normalizeKbEntry(row: Record<string, unknown>) {
  return {
    id: String(row.id || row.$id || ''),
    category: String(row.category || 'faq'),
    question_title: String(
      row.question_title || row.questionTitle || row.title || ''
    ),
    answer_content: String(
      row.answer_content || row.answerContent || row.content || ''
    ),
    created_at: String(
      row.created_at || row.$createdAt || new Date().toISOString()
    ),
    updated_at: String(
      row.updated_at || row.$updatedAt || new Date().toISOString()
    ),
  };
}

export async function GET() {
  try {
    const ctx = await requireRole('viewer');

    let rows: Array<Record<string, unknown>> = [];
    try {
      const { data, error } = await ctx.admin
        .from('knowledge_base')
        .select('*')
        .eq('account_id', ctx.accountId);

      if (!error && Array.isArray(data)) {
        rows = data as Array<Record<string, unknown>>;
      }
    } catch (err) {
      console.warn(
        '[GET /api/account/kb] soft error fetching knowledge_base:',
        err
      );
    }

    const normalized = rows.map(normalizeKbEntry);

    normalized.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.question_title.localeCompare(b.question_title);
    });

    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[GET /api/account/kb] error:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent');

    const limit = await checkRateLimit(
      `agent:kb-create:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const category = body?.category;
    const question_title = body?.question_title;
    const answer_content = body?.answer_content;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    if (
      !question_title ||
      typeof question_title !== 'string' ||
      question_title.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Question title is required' },
        { status: 400 }
      );
    }
    if (
      !answer_content ||
      typeof answer_content !== 'string' ||
      answer_content.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Answer content is required' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.admin
      .from('knowledge_base')
      .insert({
        account_id: ctx.accountId,
        category,
        question_title: question_title.trim(),
        answer_content: answer_content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/account/kb] insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create knowledge base entry' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      normalizeKbEntry(data as Record<string, unknown>),
      { status: 201 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('agent');

    const limit = await checkRateLimit(
      `agent:kb-update:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = await request.json().catch(() => null);
    const id = body?.id;
    const category = body?.category;
    const question_title = body?.question_title;
    const answer_content = body?.answer_content;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required to update an entry' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          {
            error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updates.category = category;
    }

    if (question_title !== undefined) {
      if (
        typeof question_title !== 'string' ||
        question_title.trim().length === 0
      ) {
        return NextResponse.json(
          { error: 'Question title cannot be empty' },
          { status: 400 }
        );
      }
      updates.question_title = question_title.trim();
    }

    if (answer_content !== undefined) {
      if (
        typeof answer_content !== 'string' ||
        answer_content.trim().length === 0
      ) {
        return NextResponse.json(
          { error: 'Answer content cannot be empty' },
          { status: 400 }
        );
      }
      updates.answer_content = answer_content.trim();
    }

    const { data, error } = await ctx.admin
      .from('knowledge_base')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/account/kb] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update knowledge base entry' },
        { status: 500 }
      );
    }

    return NextResponse.json(normalizeKbEntry(data as Record<string, unknown>));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireRole('agent');

    const limit = await checkRateLimit(
      `agent:kb-delete:${ctx.userId}`,
      RATE_LIMITS.adminAction
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => null);
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required to delete an entry' },
        { status: 400 }
      );
    }

    const { error } = await ctx.admin
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[DELETE /api/account/kb] delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete knowledge base entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
