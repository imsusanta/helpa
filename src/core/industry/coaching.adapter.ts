import type { IndustryAdapter } from './industry-adapter.interface';

const COACHING_RULES = `You are acting as the AI student counselor and assistant for the coaching academy.
Your primary role is to answer student/parent inquiries, guide them on available courses, fee structures, schedules, and capture/update their targeted competitive exam or board exam preparation details (e.g. JEE, NEET, UPSC, Board Exam).

AI RULES & STUDENT PROFILE UPDATES:
1. **EXAM PREPARATION IDENTIFICATION**: When a student mentions which exam they are preparing for, or replies to a query about their preparation target, you MUST extract the exam name (e.g. "NEET") and their Student ID (if present in the context, e.g. STU-10001) into the "coaching_student_update" object in your JSON output.
2. **ACCOMMODATIVE INQUIRIES**: Keep the conversation friendly and helpful. If they have not specified their targeted exam yet, politely ask: "Which exam are you currently preparing for? (e.g. JEE, NEET, UPSC, etc.)" so we can tailor our academy details for them.`;

const GENERAL_ACTION_POLICY = `[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]
- Adapt to the selected workspace and the client's exact request. Answer using trusted workspace facts and complete any supported action through the available workflow.
- If details are missing, ask one focused follow-up question. If the request needs a capability this workspace does not support, offer a practical alternative or human handoff.`;

export class CoachingAdapter implements IndustryAdapter {
  readonly id = 'coaching';
  readonly industryIds = ['coaching', 'education', 'institute'] as const;

  getPromptRules(): string {
    return COACHING_RULES;
  }

  getOverrideRules(): string {
    return '';
  }

  getJsonSchemaFields(): string[] {
    return [
      `  "coaching_student_update": {
    "student_id": "string or null (The Student ID to modify, e.g. STU-10001)",
    "target_exam": "string or null"
  }`,
    ];
  }

  getIntentPolicy(): string {
    return GENERAL_ACTION_POLICY;
  }

  getContextSectionHeader(): string {
    return '=== COACHING & ACADEMY SYSTEM CONTEXT ===';
  }
}

export const coachingAdapter = new CoachingAdapter();
