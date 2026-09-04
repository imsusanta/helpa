import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CoachingAdapter,
  coachingAdapter,
  GeneralAdapter,
  generalAdapter,
  getIndustryAdapter,
  HealthcareAdapter,
  healthcareAdapter,
  TravelAdapter,
  travelAdapter,
} from '@/core/industry';

describe('Industry Adapter Registry Suite', () => {
  describe('1. Adapter Resolution and Registry Lookup', () => {
    it('resolves HealthcareAdapter for canonical "hospital_clinic"', () => {
      const adapter = getIndustryAdapter('hospital_clinic');
      expect(adapter).toBe(healthcareAdapter);
      expect(adapter).toBeInstanceOf(HealthcareAdapter);
      expect(adapter.id).toBe('healthcare');
    });

    it('resolves HealthcareAdapter for legacy healthcare aliases', () => {
      const aliases = [
        'health',
        'hospital',
        'clinic',
        'healthcare',
        'medical',
        'doctor',
      ];
      for (const alias of aliases) {
        expect(getIndustryAdapter(alias)).toBe(healthcareAdapter);
      }
    });

    it('resolves CoachingAdapter for canonical "coaching" and aliases', () => {
      expect(getIndustryAdapter('coaching')).toBe(coachingAdapter);
      expect(getIndustryAdapter('education')).toBe(coachingAdapter);
      expect(getIndustryAdapter('institute')).toBe(coachingAdapter);
      expect(getIndustryAdapter('coaching')).toBeInstanceOf(CoachingAdapter);
      expect(coachingAdapter.id).toBe('coaching');
    });

    it('resolves TravelAdapter for canonical "travel"', () => {
      const adapter = getIndustryAdapter('travel');
      expect(adapter).toBe(travelAdapter);
      expect(adapter).toBeInstanceOf(TravelAdapter);
      expect(adapter.id).toBe('travel');
    });

    it('resolves GeneralAdapter for "general", unknown, null, and other industries', () => {
      expect(getIndustryAdapter('general')).toBe(generalAdapter);
      expect(getIndustryAdapter(null)).toBe(generalAdapter);
      expect(getIndustryAdapter(undefined)).toBe(generalAdapter);
      expect(getIndustryAdapter('')).toBe(generalAdapter);
      expect(getIndustryAdapter('unknown_xyz')).toBe(generalAdapter);
      expect(getIndustryAdapter('salon')).toBe(generalAdapter);
      expect(getIndustryAdapter('gym')).toBe(generalAdapter);
      expect(getIndustryAdapter('restaurant')).toBe(generalAdapter);
      expect(getIndustryAdapter('real_estate')).toBe(generalAdapter);
      expect(generalAdapter).toBeInstanceOf(GeneralAdapter);
      expect(generalAdapter.id).toBe('general');
    });
  });

  describe('2. HealthcareAdapter Contract', () => {
    it('returns clinical receptionist prompt rules', () => {
      const rules = healthcareAdapter.getPromptRules();
      expect(rules).toContain('NO MEDICAL DIAGNOSIS OR TREATMENT ADVICE');
      expect(rules).toContain('NO EMERGENCY HANDLING');
      expect(rules).toContain('PATIENT REGISTRATION FORM');
      expect(rules).toContain('REPORT STATUS RESPONSES');
    });

    it('returns clinical override rules', () => {
      const overrides = healthcareAdapter.getOverrideRules();
      expect(overrides).toContain('CLINICAL CONTEXT ACCURACY');
      expect(overrides).toContain('DOCTOR & CLINIC DETAILS');
      expect(overrides).toContain('SHARED WHATSAPP NUMBER DISAMBIGUATION');
    });

    it('returns hospital JSON schema fields', () => {
      const fields = healthcareAdapter.getJsonSchemaFields();
      expect(fields.length).toBe(4);
      expect(fields[0]).toContain('"hospital_patient_info"');
      expect(fields[1]).toContain('"hospital_booking"');
      expect(fields[2]).toContain('"hospital_report_send"');
      expect(fields[3]).toContain('"hospital_profile_update"');
    });

    it('returns healthcare intent policy', () => {
      const policy = healthcareAdapter.getIntentPolicy();
      expect(policy).toContain('[HEALTHCARE BOOKING BEHAVIOR]');
      expect(policy).toContain('Do not diagnose, prescribe');
    });

    it('returns hospital context section header', () => {
      expect(healthcareAdapter.getContextSectionHeader()).toBe(
        '=== HOSPITAL & CLINIC SYSTEM CONTEXT ==='
      );
    });
  });

  describe('3. CoachingAdapter Contract', () => {
    it('returns counseling prompt rules', () => {
      const rules = coachingAdapter.getPromptRules();
      expect(rules).toContain('AI student counselor and assistant');
      expect(rules).toContain('EXAM PREPARATION IDENTIFICATION');
    });

    it('returns empty override rules', () => {
      expect(coachingAdapter.getOverrideRules()).toBe('');
    });

    it('returns coaching student update schema field', () => {
      const fields = coachingAdapter.getJsonSchemaFields();
      expect(fields.length).toBe(1);
      expect(fields[0]).toContain('"coaching_student_update"');
    });

    it('returns general intent policy for counseling inquiries', () => {
      expect(coachingAdapter.getIntentPolicy()).toContain(
        '[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]'
      );
    });

    it('returns coaching context section header', () => {
      expect(coachingAdapter.getContextSectionHeader()).toBe(
        '=== COACHING & ACADEMY SYSTEM CONTEXT ==='
      );
    });
  });

  describe('4. TravelAdapter Contract', () => {
    it('returns travel booking confirm prompt rules', () => {
      const rules = travelAdapter.getPromptRules();
      expect(rules).toContain('TRAVEL BOOKING CONFIRM');
      expect(rules).toContain('offerTravelBookingConfirm');
    });

    it('returns empty override rules and empty schema fields', () => {
      expect(travelAdapter.getOverrideRules()).toBe('');
      expect(travelAdapter.getJsonSchemaFields()).toEqual([]);
    });

    it('returns travel package intent policy', () => {
      const policy = travelAdapter.getIntentPolicy();
      expect(policy).toContain('[TRAVEL PACKAGE BEHAVIOR]');
      expect(policy).toContain('Tour Package database');
    });

    it('returns travel context section header', () => {
      expect(travelAdapter.getContextSectionHeader()).toBe(
        '=== TRAVEL WORKPLACE TOUR PACKAGE CONTEXT ==='
      );
    });
  });

  describe('5. GeneralAdapter Contract', () => {
    it('returns empty rules, overrides, schema fields, and header', () => {
      expect(generalAdapter.getPromptRules()).toBe('');
      expect(generalAdapter.getOverrideRules()).toBe('');
      expect(generalAdapter.getJsonSchemaFields()).toEqual([]);
      expect(generalAdapter.getContextSectionHeader()).toBe('');
    });

    it('returns general intent policy', () => {
      expect(generalAdapter.getIntentPolicy()).toContain(
        '[WORKSPACE-SPECIFIC CLIENT BEHAVIOR]'
      );
    });
  });

  describe('6. Architectural Integrity & Boundary Checks', () => {
    const adapterDir = path.resolve(__dirname, '../../core/industry');

    it('guarantees pure adapters never import Supabase, DB, or network clients', () => {
      const files = fs
        .readdirSync(adapterDir)
        .filter((f) => f.endsWith('.adapter.ts'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(adapterDir, file), 'utf-8');
        expect(content).not.toMatch(/from\s+['"].*supabase.*['"]/i);
        expect(content).not.toMatch(/from\s+['"].*db\/server.*['"]/i);
        expect(content).not.toMatch(/from\s+['"].*whatsapp\/transport.*['"]/i);
        expect(content).not.toMatch(/from\s+['"].*provider.*['"]/i);
      }
    });

    it('guarantees industry adapters do NOT import each other', () => {
      const adapterFiles = [
        'healthcare.adapter.ts',
        'coaching.adapter.ts',
        'travel.adapter.ts',
        'general.adapter.ts',
      ];

      for (const currentFile of adapterFiles) {
        const content = fs.readFileSync(
          path.join(adapterDir, currentFile),
          'utf-8'
        );
        const otherFiles = adapterFiles.filter((f) => f !== currentFile);
        for (const other of otherFiles) {
          const baseName = other.replace('.ts', '');
          expect(content).not.toContain(baseName);
        }
      }
    });
  });
});
