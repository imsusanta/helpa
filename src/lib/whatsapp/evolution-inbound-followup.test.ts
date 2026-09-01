import { beforeEach, describe, expect, it, vi } from 'vitest';

const travel = vi.hoisted(() => ({
  handleTravelBookingInbound: vi.fn(),
}));
const automations = vi.hoisted(() => ({
  runAutomationsForTrigger: vi.fn(),
}));

vi.mock('@/lib/travel/booking-confirm', () => ({
  handleTravelBookingInbound: travel.handleTravelBookingInbound,
}));
vi.mock('@/lib/automations/engine', () => ({
  runAutomationsForTrigger: automations.runAutomationsForTrigger,
}));

import { dispatchEvolutionInboundFollowup } from './evolution-inbound-followup';

describe('dispatchEvolutionInboundFollowup', () => {
  beforeEach(() => {
    travel.handleTravelBookingInbound.mockReset();
    automations.runAutomationsForTrigger.mockReset();
  });

  it('stops after a Confirm Booking tap is handled', async () => {
    travel.handleTravelBookingInbound.mockResolvedValue(true);
    const result = await dispatchEvolutionInboundFollowup({
      accountId: 'acct',
      userId: 'user',
      contactId: 'contact',
      conversationId: 'conv',
      inboundText: 'Confirm Booking',
      interactiveReplyId: 'travel_booking_confirm',
    });
    expect(result).toEqual({ handled: true });
    expect(automations.runAutomationsForTrigger).not.toHaveBeenCalled();
  });

  it('runs keyword automations so Booking Confirm can send buttons', async () => {
    travel.handleTravelBookingInbound.mockResolvedValue(false);
    automations.runAutomationsForTrigger.mockResolvedValue({
      executedCount: 1,
      replied: true,
    });
    const result = await dispatchEvolutionInboundFollowup({
      accountId: 'acct',
      userId: 'user',
      contactId: 'contact',
      conversationId: 'conv',
      inboundText: 'booking confirm',
    });
    expect(result).toEqual({ handled: true });
    expect(automations.runAutomationsForTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'keyword_match',
        context: expect.objectContaining({ message_text: 'booking confirm' }),
      })
    );
  });
});
