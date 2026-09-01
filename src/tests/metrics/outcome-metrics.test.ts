import { describe, it, expect } from 'vitest';
import {
  createSubjectHash,
  sanitizeOutcomeAttributes,
  normalizeSourceId,
  recordOutcomeEvent,
} from '@/lib/metrics/outcome-events';
import {
  calculateMedianFirstResponseTime,
  calculateBookingsHandled,
  calculateAutomationSuccessRate,
  calculatePatientReturnRate,
  generateObservationReadinessReport,
  OutcomeEventRecord,
} from '@/lib/metrics/outcome-aggregation';
import {
  calculateReliabilityCounts,
  calculateReliabilityRates,
} from '@/lib/metrics/reliability-aggregation';
import { isConfiguredTestTenant } from '@/lib/metrics/safe-record';

describe('Product Outcome Events & Privacy Hashing', () => {
  it('creates deterministic one-way 64-character SHA-256 subject hashes', () => {
    const hash1 = createSubjectHash('tenant-123', '+919876543210');
    const hash2 = createSubjectHash('tenant-123', '+919876543210');
    const hashOther = createSubjectHash('tenant-456', '+919876543210');

    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashOther);
  });

  it('sanitizes attributes to remove prohibited patient identifiers and message content', () => {
    const dirty = {
      name: 'John Doe',
      patient_name: 'Jane Doe',
      phone: '+919876543210',
      email: 'john@example.com',
      message: 'I have chest pain',
      message_body: 'Book me an appointment',
      is_automated: true,
      channel: 'whatsapp',
      intent: 'appointment_enquiry',
      response_time_seconds: 4.2,
    };

    const clean = sanitizeOutcomeAttributes(dirty);

    expect(clean).not.toHaveProperty('name');
    expect(clean).not.toHaveProperty('patient_name');
    expect(clean).not.toHaveProperty('phone');
    expect(clean).not.toHaveProperty('email');
    expect(clean).not.toHaveProperty('message');
    expect(clean).not.toHaveProperty('message_body');
    expect(clean).toEqual({
      is_automated: true,
      channel: 'whatsapp',
      intent: 'appointment_enquiry',
      response_time_seconds: 4.2,
    });
  });

  it('normalizes source ID length to between 16 and 200 characters', () => {
    const shortId = normalizeSourceId('short');
    expect(shortId.length).toBeGreaterThanOrEqual(16);
    expect(shortId.length).toBeLessThanOrEqual(200);

    const normalId = normalizeSourceId('unique-webhook-event-123456789');
    expect(normalId).toBe('unique-webhook-event-123456789');

    const longId = normalizeSourceId('a'.repeat(300));
    expect(longId.length).toBe(200);
  });

  it('handles missing required fields safely in recordOutcomeEvent', async () => {
    // @ts-expect-error test invalid input
    const res = await recordOutcomeEvent({ accountId: '' });
    expect(res.recorded).toBe(false);
    expect(res.error).toBe('MISSING_REQUIRED_FIELDS');
  });
});

describe('Product Outcome Metrics Aggregation & Observation Readiness', () => {
  const sampleEvents: OutcomeEventRecord[] = [
    // 12 First response events (10 automated, 2 human)
    ...Array.from({ length: 10 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'first_response_sent',
      event_version: 1,
      occurred_at: '2026-08-01T10:00:00Z',
      source_id: `resp-auto-${i + 1}-1234567890`,
      subject_hash: null,
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { is_automated: true, response_time_seconds: 5 + i },
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'first_response_sent',
      event_version: 1,
      occurred_at: '2026-08-01T10:00:00Z',
      source_id: `resp-human-${i + 1}-1234567890`,
      subject_hash: null,
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { is_automated: false, response_time_seconds: 60 + i * 10 },
    })),

    // 15 Booking confirmed events
    ...Array.from({ length: 15 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'booking_confirmed',
      event_version: 1,
      occurred_at: '2026-08-01T11:00:00Z',
      source_id: `book-${i + 1}-1234567890`,
      subject_hash: createSubjectHash('tenant-1', `booking-patient-${i}`),
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { channel: 'whatsapp', is_whatsapp: true },
    })),

    // 20 Automation eligible, 17 completed, 2 takeover, 1 error
    ...Array.from({ length: 20 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'automation_eligible',
      event_version: 1,
      occurred_at: '2026-08-01T12:00:00Z',
      source_id: `auto-elig-${i + 1}-1234567890`,
      subject_hash: null,
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { intent: 'booking' },
    })),
    ...Array.from({ length: 17 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'automation_completed',
      event_version: 1,
      occurred_at: '2026-08-01T12:05:00Z',
      source_id: `auto-comp-${i + 1}-1234567890`,
      subject_hash: null,
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { intent: 'booking' },
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'staff_takeover',
      event_version: 1,
      occurred_at: '2026-08-01T12:05:00Z',
      source_id: `staff-take-${i + 1}-1234567890`,
      subject_hash: null,
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { reason: 'patient_request' },
    })),
    {
      account_id: 'tenant-1',
      event_name: 'automation_error',
      event_version: 1,
      occurred_at: '2026-08-01T12:05:00Z',
      source_id: 'auto-err-1-1234567890',
      subject_hash: null,
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { error_code: 'RATE_LIMIT' },
    },

    // 12 Completed visits, 4 returns
    ...Array.from({ length: 12 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'appointment_completed',
      event_version: 1,
      occurred_at: '2026-08-01T14:00:00Z',
      source_id: `appt-comp-${i + 1}-1234567890`,
      subject_hash: createSubjectHash('tenant-1', `patient-${i}`),
      is_synthetic: false,
      is_test_tenant: false,
      attributes: {},
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      account_id: 'tenant-1',
      event_name: 'patient_return_completed',
      event_version: 1,
      occurred_at: '2026-08-15T14:00:00Z',
      source_id: `patient-ret-${i + 1}-1234567890`,
      subject_hash: createSubjectHash('tenant-1', `patient-${i}`),
      is_synthetic: false,
      is_test_tenant: false,
      attributes: { days_since_last_visit: 14 },
    })),
  ];

  it('calculates median first-response time correctly', () => {
    const res = calculateMedianFirstResponseTime(sampleEvents);
    expect(res.isSuppressed).toBe(false);
    expect(res.sampleSize).toBe(12);
    expect(res.automatedCount).toBe(10);
    expect(res.humanCount).toBe(2);
    expect(res.medianSeconds).toBe(10.5); // sorted: 5,6,7,8,9,10,11,12,13,14,60,70 -> median (10+11)/2 = 10.5
  });

  it('suppresses metrics when cohort size is below safety threshold (<10)', () => {
    const tinyEvents = sampleEvents.slice(0, 3);
    const res = calculateMedianFirstResponseTime(tinyEvents);
    expect(res.isSuppressed).toBe(true);
    expect(res.medianSeconds).toBeNull();
  });

  it('calculates bookings handled and whatsapp attribution', () => {
    const res = calculateBookingsHandled(sampleEvents);
    expect(res.isSuppressed).toBe(false);
    expect(res.totalConfirmedBookings).toBe(15);
    expect(res.whatsappAttributed).toBe(15);
  });

  it('calculates automation success rate', () => {
    const res = calculateAutomationSuccessRate(sampleEvents);
    expect(res.isSuppressed).toBe(false);
    expect(res.eligibleStarted).toBe(20);
    expect(res.completedWithoutTakeover).toBe(17);
    expect(res.takeoverCount).toBe(2);
    expect(res.errorCount).toBe(1);
    expect(res.successRatePercent).toBe(85);
  });

  it('calculates patient return rate with unique subject hashes', () => {
    const res = calculatePatientReturnRate(sampleEvents);
    expect(res.isSuppressed).toBe(false);
    expect(res.uniqueCohortSize).toBe(12);
    expect(res.returningPatientCount).toBe(4);
    expect(res.returnRatePercent).toBe(33.3);
  });

  it('generates observation-readiness report blocking publication if < 30 days', () => {
    const reportBlocked = generateObservationReadinessReport(
      sampleEvents,
      '2026-08-10',
      '2026-08-20' // 10 days elapsed
    );

    expect(reportBlocked.status).toBe('BLOCKED_BY_OBSERVATION_WINDOW');
    expect(reportBlocked.elapsedDays).toBe(10);
    expect(reportBlocked.requiredDays).toBe(30);
    expect(reportBlocked.isProductionObservationComplete).toBe(false);
    expect(reportBlocked.earliestValidPublicationDate).toBe('2026-09-09');

    const reportReady = generateObservationReadinessReport(
      sampleEvents,
      '2026-07-01',
      '2026-08-01' // 31 days elapsed
    );

    expect(reportReady.status).toBe('READY_FOR_CALCULATION');
    expect(reportReady.elapsedDays).toBe(31);
    expect(reportReady.isProductionObservationComplete).toBe(true);
  });

  it('counts reliability events and suppresses rates below the cohort floor', () => {
    const reliabilityEvents: OutcomeEventRecord[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        account_id: 'tenant-1',
        event_name: 'inbound_message_received',
        event_version: 1,
        occurred_at: '2026-08-01T10:00:00Z',
        source_id: `in-${i + 1}-1234567890abcd`,
        subject_hash: null,
        is_synthetic: false,
        is_test_tenant: false,
        attributes: { channel: 'whatsapp' },
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        account_id: 'tenant-1',
        event_name: 'message_delivery_failed',
        event_version: 1,
        occurred_at: '2026-08-01T10:00:00Z',
        source_id: `fail-${i + 1}-1234567890abcd`,
        subject_hash: null,
        is_synthetic: false,
        is_test_tenant: false,
        attributes: { channel: 'whatsapp' },
      })),
      {
        account_id: 'tenant-1',
        event_name: 'webhook_failed',
        event_version: 1,
        occurred_at: '2026-08-01T10:00:00Z',
        source_id: 'webhook-fail-1234567890',
        subject_hash: null,
        is_synthetic: true,
        is_test_tenant: false,
        attributes: { reason: 'inbound_persist_failed' },
      },
    ];

    const counts = calculateReliabilityCounts(reliabilityEvents);
    expect(counts.inboundReceived).toBe(12);
    expect(counts.deliveryFailures).toBe(2);
    expect(counts.webhookFailures).toBe(0);

    const rates = calculateReliabilityRates(reliabilityEvents);
    expect(rates.isSuppressed).toBe(false);
    expect(rates.deliveryFailureRatePercent).toBe(16.7);
  });

  it('marks configured demo accounts as test tenants', () => {
    const previous = process.env.DEMO_ACCOUNT_ID;
    process.env.DEMO_ACCOUNT_ID = '00000000-0000-4000-8000-000000000001';
    expect(isConfiguredTestTenant('00000000-0000-4000-8000-000000000001')).toBe(
      true
    );
    expect(isConfiguredTestTenant('00000000-0000-4000-8000-000000000099')).toBe(
      false
    );
    process.env.DEMO_ACCOUNT_ID = previous;
  });
});
