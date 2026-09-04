import { describe, expect, it } from 'vitest';
import { withIntentFulfillmentPolicy } from '@/core/ai/intent-fulfillment';
import {
  buildReceptionistJsonSchema,
  buildReceptionistSystemPrompt,
  RECEPTIONIST_JSON_SCHEMA,
  type ReceptionistPromptInput,
} from '@/lib/whatsapp/ai-prompt';

describe('Industry Adapter Equivalence Suite', () => {
  describe('1. Receptionist JSON Schema Equivalence', () => {
    it('produces expected default schema with both hospital and coaching enabled', () => {
      const schema = RECEPTIONIST_JSON_SCHEMA;
      expect(schema).toContain('"reply"');
      expect(schema).toContain('"intent"');
      expect(schema).toContain('"hospital_patient_info"');
      expect(schema).toContain('"hospital_booking"');
      expect(schema).toContain('"hospital_report_send"');
      expect(schema).toContain('"hospital_profile_update"');
      expect(schema).toContain('"coaching_student_update"');
      expect(schema).toContain('"emergency_detected"');
    });

    it('omits hospital fields when isHospitalEnabled is false', () => {
      const schema = buildReceptionistJsonSchema({
        isHospitalEnabled: false,
        isCoachingEnabled: true,
      });
      expect(schema).not.toContain('"hospital_patient_info"');
      expect(schema).not.toContain('"hospital_booking"');
      expect(schema).toContain('"coaching_student_update"');
      expect(schema).toContain('"emergency_detected"');
    });

    it('omits coaching fields when isCoachingEnabled is false', () => {
      const schema = buildReceptionistJsonSchema({
        isHospitalEnabled: true,
        isCoachingEnabled: false,
      });
      expect(schema).toContain('"hospital_patient_info"');
      expect(schema).toContain('"hospital_booking"');
      expect(schema).not.toContain('"coaching_student_update"');
      expect(schema).toContain('"emergency_detected"');
    });

    it('omits both hospital and coaching fields when both are false', () => {
      const schema = buildReceptionistJsonSchema({
        isHospitalEnabled: false,
        isCoachingEnabled: false,
      });
      expect(schema).not.toContain('"hospital_patient_info"');
      expect(schema).not.toContain('"hospital_booking"');
      expect(schema).not.toContain('"coaching_student_update"');
      expect(schema).toContain('"emergency_detected"');
    });
  });

  describe('2. Receptionist System Prompt Equivalence', () => {
    const baseInput: ReceptionistPromptInput = {
      industry: 'hospital_clinic',
      customSystemPrompt: null,
      businessName: 'City Care Hospital',
      welcomeMessage: 'Welcome to City Care Hospital! How can we help?',
      responseStyle: 'balanced',
      kbContext: '[FAQ] Timings: 9am - 9pm',
      hospitalContext: '- Dr. Roy (Cardiology): Fee: 500',
      coachingContext: '',
      isHospitalEnabled: true,
      isCoachingEnabled: false,
      isTravelEnabled: false,
      latestCustomerText: 'Cardiologist er appointment chai',
    };

    it('renders healthcare system prompt with all expected clinical sections', () => {
      const prompt = buildReceptionistSystemPrompt(baseInput);

      expect(prompt).toContain('City Care Hospital');
      expect(prompt).toContain('CLINICAL CONTEXT ACCURACY');
      expect(prompt).toContain('DOCTOR & CLINIC DETAILS');
      expect(prompt).toContain('PATIENT DETAILS & LOOKUP');
      expect(prompt).toContain('=== HOSPITAL & CLINIC SYSTEM CONTEXT ===');
      expect(prompt).toContain('- Dr. Roy (Cardiology): Fee: 500');
      expect(prompt).toContain('NO MEDICAL DIAGNOSIS OR TREATMENT ADVICE');
      expect(prompt).toContain('PATIENT REGISTRATION FORM');
      expect(prompt).toContain('REPORT STATUS RESPONSES');
      expect(prompt).not.toContain('=== COACHING & ACADEMY SYSTEM CONTEXT ===');
      expect(prompt).not.toContain(
        '=== TRAVEL WORKPLACE TOUR PACKAGE CONTEXT ==='
      );
    });

    it('renders coaching system prompt with counseling sections', () => {
      const coachingInput: ReceptionistPromptInput = {
        ...baseInput,
        industry: 'coaching',
        businessName: 'Apex Academy',
        isHospitalEnabled: false,
        isCoachingEnabled: true,
        isTravelEnabled: false,
        coachingContext: '- Name: Rahul, Student ID: STU-101, Exam: NEET',
        hospitalContext: '',
      };

      const prompt = buildReceptionistSystemPrompt(coachingInput);

      expect(prompt).toContain('Apex Academy');
      expect(prompt).toContain('=== COACHING & ACADEMY SYSTEM CONTEXT ===');
      expect(prompt).toContain('AI student counselor and assistant');
      expect(prompt).toContain('EXAM PREPARATION IDENTIFICATION');
      expect(prompt).not.toContain('=== HOSPITAL & CLINIC SYSTEM CONTEXT ===');
      expect(prompt).not.toContain(
        '=== TRAVEL WORKPLACE TOUR PACKAGE CONTEXT ==='
      );
    });

    it('renders travel system prompt with tour package context and booking rules', () => {
      const travelInput: ReceptionistPromptInput = {
        ...baseInput,
        industry: 'travel',
        businessName: 'Wanderlust Tours',
        isHospitalEnabled: false,
        isCoachingEnabled: false,
        isTravelEnabled: true,
        travelPackageContext: 'Available Packages:\n- Goa 3N/4D: Rs 15,000',
        hospitalContext: '',
        coachingContext: '',
      };

      const prompt = buildReceptionistSystemPrompt(travelInput);

      expect(prompt).toContain('Wanderlust Tours');
      expect(prompt).toContain('=== TRAVEL WORKPLACE TOUR PACKAGE CONTEXT ===');
      expect(prompt).toContain('Goa 3N/4D: Rs 15,000');
      expect(prompt).toContain('TRAVEL BOOKING CONFIRM');
      expect(prompt).toContain('offerTravelBookingConfirm');
      expect(prompt).not.toContain('=== HOSPITAL & CLINIC SYSTEM CONTEXT ===');
      expect(prompt).not.toContain('=== COACHING & ACADEMY SYSTEM CONTEXT ===');
    });
  });

  describe('3. Intent Fulfillment Policy Equivalence', () => {
    it('applies healthcare policy to hospital_clinic and health', () => {
      const prompt = withIntentFulfillmentPolicy(
        'Base prompt',
        'hospital_clinic'
      );
      expect(prompt).toContain('[MANDATORY INTENT FULFILLMENT POLICY]');
      expect(prompt).toContain('[HEALTHCARE BOOKING BEHAVIOR]');
      expect(prompt).not.toContain('[TRAVEL PACKAGE BEHAVIOR]');
      expect(prompt).not.toContain('[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]');

      const aliasPrompt = withIntentFulfillmentPolicy('Base prompt', 'health');
      expect(aliasPrompt).toContain('[HEALTHCARE BOOKING BEHAVIOR]');
    });

    it('applies travel package policy to travel', () => {
      const prompt = withIntentFulfillmentPolicy('Base prompt', 'travel');
      expect(prompt).toContain('[MANDATORY INTENT FULFILLMENT POLICY]');
      expect(prompt).toContain('[TRAVEL PACKAGE BEHAVIOR]');
      expect(prompt).not.toContain('[HEALTHCARE BOOKING BEHAVIOR]');
      expect(prompt).not.toContain('[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]');
    });

    it('applies general workspace policy to coaching and other industries', () => {
      const coachingPrompt = withIntentFulfillmentPolicy(
        'Base prompt',
        'coaching'
      );
      expect(coachingPrompt).toContain('[MANDATORY INTENT FULFILLMENT POLICY]');
      expect(coachingPrompt).toContain('[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]');
      expect(coachingPrompt).not.toContain('[HEALTHCARE BOOKING BEHAVIOR]');
      expect(coachingPrompt).not.toContain('[TRAVEL PACKAGE BEHAVIOR]');

      const salonPrompt = withIntentFulfillmentPolicy('Base prompt', 'salon');
      expect(salonPrompt).toContain('[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]');

      const generalPrompt = withIntentFulfillmentPolicy(
        'Base prompt',
        'general'
      );
      expect(generalPrompt).toContain('[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]');

      const nullPrompt = withIntentFulfillmentPolicy('Base prompt', null);
      expect(nullPrompt).toContain('[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]');
    });

    it('is idempotent when policy marker is already present', () => {
      const first = withIntentFulfillmentPolicy(
        'Base prompt',
        'hospital_clinic'
      );
      const second = withIntentFulfillmentPolicy(first, 'hospital_clinic');
      expect(second).toBe(first);
    });
  });
});
