import { describe, expect, it } from 'vitest';
import {
  BACKOFF_SCHEDULE_SECONDS,
  DEFAULT_MAX_ATTEMPTS,
  calculateOutboxBackoff,
} from './whatsapp-outbox.service';

describe('WhatsApp Outbox Retry & Backoff Policy', () => {
  it('follows the configured base backoff schedule when jitter is 0', () => {
    // With randomFn returning 0.5 and jitterRatio 0.2: multiplier is 1 - 0.1 + 0.5 * 0.2 = 1.0 (exact base)
    const exactRandom = () => 0.5;

    expect(
      calculateOutboxBackoff(1, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[0]); // 30s
    expect(
      calculateOutboxBackoff(2, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[1]); // 120s
    expect(
      calculateOutboxBackoff(3, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[2]); // 300s
    expect(
      calculateOutboxBackoff(4, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[3]); // 900s
    expect(
      calculateOutboxBackoff(5, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[4]); // 3600s
    expect(
      calculateOutboxBackoff(6, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[5]); // 14400s
    expect(
      calculateOutboxBackoff(7, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(BACKOFF_SCHEDULE_SECONDS[6]); // 43200s
  });

  it('clamps higher attempts to the maximum schedule window', () => {
    const exactRandom = () => 0.5;
    expect(
      calculateOutboxBackoff(8, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(43200);
    expect(
      calculateOutboxBackoff(20, { jitterRatio: 0.2, randomFn: exactRandom })
    ).toBe(43200);
  });

  it('bounds jitter strictly between [1 - ratio/2, 1 + ratio/2]', () => {
    const minRandom = () => 0.0;
    const maxRandom = () => 1.0;

    const minBackoff = calculateOutboxBackoff(1, {
      jitterRatio: 0.2,
      randomFn: minRandom,
    });
    const maxBackoff = calculateOutboxBackoff(1, {
      jitterRatio: 0.2,
      randomFn: maxRandom,
    });

    // 30 * 0.9 = 27s
    expect(minBackoff).toBe(27);
    // 30 * 1.1 = 33s
    expect(maxBackoff).toBe(33);
  });

  it('never produces backoff less than 5 seconds', () => {
    const minRandom = () => 0.0;
    expect(
      calculateOutboxBackoff(1, { jitterRatio: 1.0, randomFn: minRandom })
    ).toBeGreaterThanOrEqual(5);
  });

  it('defines 8 maximum attempts by default', () => {
    expect(DEFAULT_MAX_ATTEMPTS).toBe(8);
  });
});
