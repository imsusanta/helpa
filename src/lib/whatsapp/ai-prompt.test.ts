import { describe, expect, it } from 'vitest';
import {
  RECEPTIONIST_JSON_SCHEMA,
  buildReceptionistSystemPrompt,
} from './ai-prompt';

const BASE = {
  industry: 'health' as const,
  customSystemPrompt: null,
  businessName: 'Siliguri Nursing Home',
  welcomeMessage: null,
  responseStyle: 'balanced' as const,
  kbContext: '',
  hospitalContext: 'Dr. Test — Cardiology',
  coachingContext: '',
  isHospitalEnabled: true,
  isCoachingEnabled: false,
  latestCustomerText: 'I want to book an appointment',
};

describe('buildReceptionistSystemPrompt', () => {
  it('names the clinic and requires JSON output', () => {
    const prompt = buildReceptionistSystemPrompt(BASE);
    expect(prompt).toContain('Siliguri Nursing Home');
    expect(prompt).toContain('CRITICAL OUTPUT FORMAT RULE');
    expect(prompt).toContain(RECEPTIONIST_JSON_SCHEMA);
    expect(prompt).toContain('emergency_detected');
  });

  it('includes hospital safety rules only when hospital mode is on', () => {
    const on = buildReceptionistSystemPrompt(BASE);
    const off = buildReceptionistSystemPrompt({
      ...BASE,
      isHospitalEnabled: false,
      hospitalContext: '',
    });
    expect(on).toContain('NO MEDICAL DIAGNOSIS OR TREATMENT ADVICE');
    expect(on).toContain('NO EMERGENCY HANDLING');
    expect(on).toContain('Dr. Test — Cardiology');
    expect(off).not.toContain('NO MEDICAL DIAGNOSIS OR TREATMENT ADVICE');
  });

  it('includes coaching exam-capture rules only when coaching mode is on', () => {
    const prompt = buildReceptionistSystemPrompt({
      ...BASE,
      isHospitalEnabled: false,
      isCoachingEnabled: true,
      coachingContext: 'Student ID: STU-10001',
    });
    expect(prompt).toContain('EXAM PREPARATION IDENTIFICATION');
    expect(prompt).toContain('STU-10001');
    expect(prompt).toContain('coaching_student_update');
  });

  it('injects the workspace welcome message', () => {
    const prompt = buildReceptionistSystemPrompt({
      ...BASE,
      welcomeMessage: 'Namaste, welcome to our clinic!',
    });
    expect(prompt).toContain('MANDATORY CUSTOM WELCOME GREETING TEMPLATE');
    expect(prompt).toContain('Namaste, welcome to our clinic!');
  });

  it('pins the reply language to the latest customer message', () => {
    const prompt = buildReceptionistSystemPrompt({
      ...BASE,
      latestCustomerText: 'ami doctor dekhte chai',
    });
    expect(prompt).toContain('CRITICAL MANDATORY MULTILINGUAL RULE');
    expect(prompt).toContain('ami doctor dekhte chai');
    expect(prompt).toContain('EXACT SAME LANGUAGE');
  });

  it('includes knowledge-base context when provided', () => {
    const prompt = buildReceptionistSystemPrompt({
      ...BASE,
      kbContext: '[PRICING] Consultation: ₹500',
    });
    expect(prompt).toContain('[PRICING] Consultation: ₹500');
  });
});
