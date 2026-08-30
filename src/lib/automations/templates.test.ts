import { describe, expect, it } from 'vitest';

import {
  AUTOMATION_TEMPLATES,
  getTemplate,
  getTemplateForIndustry,
  getTemplatesForIndustry,
  type TemplateSlug,
} from './templates';
import { triggerMeta } from './trigger-meta';
import {
  validateStepsForActivation,
  validateTriggerForActivation,
} from './validate';

const SLUGS = Object.keys(AUTOMATION_TEMPLATES) as TemplateSlug[];

/**
 * Templates whose trigger deliberately ships blank because the value is
 * account-specific (the user picks the tag in the builder). Everything
 * else must be activatable straight from the gallery.
 */
const NEEDS_TAG_PICK: TemplateSlug[] = [
  'report_ready_alert',
  'post_visit_feedback',
];

function stepsForValidation(slug: TemplateSlug) {
  return AUTOMATION_TEMPLATES[slug].steps.map((step) => ({
    step_type: step.step_type as string,
    step_config: step.step_config as Record<string, unknown>,
  }));
}

describe('automation templates', () => {
  it('keys every entry under its own slug', () => {
    for (const slug of SLUGS) {
      expect(AUTOMATION_TEMPLATES[slug].slug).toBe(slug);
    }
  });

  it('gives every template a name, description, and at least one step', () => {
    for (const slug of SLUGS) {
      const template = AUTOMATION_TEMPLATES[slug];
      expect(template.name.trim()).not.toBe('');
      expect(template.description.trim()).not.toBe('');
      expect(template.steps.length).toBeGreaterThan(0);
      expect(template.industries.length).toBeGreaterThan(0);
      expect(template.iconName).toBeTruthy();
    }
  });

  it('only nests seeds under an earlier condition step', () => {
    for (const slug of SLUGS) {
      const { steps } = AUTOMATION_TEMPLATES[slug];
      steps.forEach((step, index) => {
        if (step.parent_index === undefined || step.parent_index === null) {
          return;
        }
        expect(step.parent_index).toBeLessThan(index);
        expect(steps[step.parent_index].step_type).toBe('condition');
        expect(step.branch === 'yes' || step.branch === 'no').toBe(true);
      });
    }
  });

  it('ships steps that pass activation validation as-is', () => {
    for (const slug of SLUGS) {
      expect(validateStepsForActivation(stepsForValidation(slug))).toEqual([]);
    }
  });

  it('ships triggers that pass activation validation, except tag pickers', () => {
    for (const slug of SLUGS) {
      const template = AUTOMATION_TEMPLATES[slug];
      const issues = validateTriggerForActivation(
        template.trigger_type,
        template.trigger_config
      );
      if (NEEDS_TAG_PICK.includes(slug)) {
        expect(issues.length).toBeGreaterThan(0);
      } else {
        expect(issues).toEqual([]);
      }
    }
  });

  it('renders a human-readable trigger label for every template', () => {
    for (const slug of SLUGS) {
      const meta = triggerMeta(AUTOMATION_TEMPLATES[slug].trigger_type);
      expect(meta.label).not.toContain('_');
      expect(meta.pillClass.trim()).not.toBe('');
    }
  });

  it('labels appointment triggers dispatched by the engine', () => {
    expect(triggerMeta('appointment_created').label).toBe('Appointment Booked');
    expect(triggerMeta('appointment_reminder').label).toBe(
      'Appointment Reminder'
    );
    expect(triggerMeta('appointment_cancelled').label).toBe(
      'Appointment Cancelled'
    );
  });

  it('humanises unknown trigger slugs instead of leaking them raw', () => {
    expect(triggerMeta('some_future_trigger').label).toBe(
      'Some Future Trigger'
    );
    expect(triggerMeta(undefined).label).toBe('Unknown Trigger');
  });

  it('resolves known slugs and rejects unknown ones', () => {
    expect(getTemplate('welcome_message')?.slug).toBe('welcome_message');
    expect(getTemplate('does_not_exist')).toBeNull();
  });

  it('returns only travel, shared, and explicitly approved templates', () => {
    const templates = getTemplatesForIndustry('travel');
    const slugs = templates.map((template) => template.slug);
    expect(slugs).toContain('traveler_intake_greeting');
    expect(slugs).toContain('tour_package_enquiry');
    expect(slugs).toContain('quote_follow_up');
    expect(slugs).toContain('trip_booking_confirmation');
    expect(slugs).toContain('trip_departure_reminder');
    expect(slugs).toContain('welcome_message');
    const firstShared = slugs.indexOf('welcome_message');
    expect(slugs.indexOf('tour_package_enquiry')).toBeLessThan(firstShared);
    expect(slugs.indexOf('trip_booking_confirmation')).toBeLessThan(
      firstShared
    );
    expect(slugs).not.toContain('doctor_booking_enquiry');
    expect(slugs).not.toContain('lab_test_booking');
    expect(slugs).not.toContain('table_booking');
  });

  it('returns clinic templates for both health aliases', () => {
    const health = getTemplatesForIndustry('health').map((t) => t.slug);
    const clinic = getTemplatesForIndustry('hospital_clinic').map(
      (t) => t.slug
    );
    expect(health).toEqual(clinic);
    expect(health).toContain('doctor_booking_enquiry');
    expect(health).not.toContain('traveler_intake_greeting');
    expect(health).not.toContain('tour_package_enquiry');
    expect(health).not.toContain('quote_follow_up');
    expect(health).not.toContain('trip_booking_confirmation');
    expect(health).not.toContain('trip_departure_reminder');
    expect(health).not.toContain('table_booking');
  });

  it('keeps general, null, and unknown industries fail-safe', () => {
    const general = getTemplatesForIndustry('general').map((t) => t.slug);
    expect(general).toContain('welcome_message');
    expect(general).not.toContain('doctor_booking_enquiry');
    expect(general).not.toContain('traveler_intake_greeting');
    expect(general).not.toContain('tour_package_enquiry');
    expect(general).not.toContain('trip_booking_confirmation');
    expect(getTemplatesForIndustry(null).map((t) => t.slug)).toEqual(general);
    expect(
      getTemplatesForIndustry('legacy_unknown').map((t) => t.slug)
    ).toEqual(general);
  });

  it('has stable unique ordering and rejects unauthorized template lookups', () => {
    const first = getTemplatesForIndustry('restaurant').map((t) => t.slug);
    const second = getTemplatesForIndustry('restaurant').map((t) => t.slug);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(
      getTemplateForIndustry('doctor_booking_enquiry', 'travel')
    ).toBeNull();
    expect(
      getTemplateForIndustry('doctor_booking_enquiry', 'health')?.slug
    ).toBe('doctor_booking_enquiry');
  });
});
