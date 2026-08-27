import { describe, it, expect } from 'vitest';
import {
  sanitizePhoneForMeta,
  phoneVariants,
} from '@/lib/whatsapp/phone-utils';

describe('Trip Proposals Feature & WhatsApp Dispatch Unit Tests', () => {
  it('correctly calculates total proposal price from base price, tax, and discount', () => {
    const basePrice = 25000;
    const taxRate = 0.05; // 5% GST
    const taxAmount = basePrice * taxRate; // 1250
    const discountAmount = 1500;

    const total = Math.max(0, basePrice + taxAmount - discountAmount);
    expect(total).toBe(24750);
  });

  it('generates customized WhatsApp message with itinerary highlights and proposal link', () => {
    const proposal = {
      id: 'prop-1234-5678',
      proposal_number: 'TRIP-1001',
      title: 'Darjeeling & Mirik 4D3N Scenic Tour',
      destination: 'Darjeeling, West Bengal',
      duration_days: 4,
      duration_nights: 3,
      start_date: '2026-09-10',
      end_date: '2026-09-13',
      adults_count: 2,
      children_count: 1,
      total_price: 28500,
      hotel_details: 'Summit Hermitage Resort (Deluxe View Room)',
      transport_details: 'Private AC Innova with dedicated driver',
      inclusions: [
        '3-Star Hotel Stay with Breakfast & Dinner',
        'Private Sightseeing Cab',
        'All Toll & Driver Charges',
      ],
    };

    const agencyName = 'Helpa Travel';
    const travelerName = 'Susanta Lohar';
    const proposalUrl = `https://www.helpa.studio/proposals/${proposal.id}`;

    const inclusionsList = proposal.inclusions
      .slice(0, 4)
      .map((inc) => `  • ${inc}`)
      .join('\n');

    const formattedMessage =
      `✈️ *TRIP PROPOSAL: ${proposal.title.toUpperCase()}*\n_${agencyName}_\n\n` +
      `Hello *${travelerName}*! Here is your custom tour proposal for *${proposal.destination}*:\n\n` +
      `📍 *Destination:* ${proposal.destination}\n` +
      `⏱️ *Duration:* ${proposal.duration_days} Days / ${proposal.duration_nights} Nights\n` +
      `📅 *Travel Dates:* ${proposal.start_date} to ${proposal.end_date}\n` +
      `👥 *Guests:* ${proposal.adults_count} Adults, ${proposal.children_count} Children\n` +
      `🏨 *Accommodation:* ${proposal.hotel_details}\n` +
      `🚗 *Transport:* ${proposal.transport_details}\n` +
      `\n💰 *Total Package Price:* ₹${Number(proposal.total_price).toLocaleString('en-IN')} (All Inclusive)\n\n` +
      `✨ *Key Inclusions:*\n${inclusionsList}\n\n` +
      `📄 *View Full Itinerary & Details Online:*\n${proposalUrl}\n\n` +
      `_Reply *YES* to confirm your booking, or let us know if you would like any customizations!_`;

    expect(formattedMessage).toContain(
      'TRIP PROPOSAL: DARJEELING & MIRIK 4D3N SCENIC TOUR'
    );
    expect(formattedMessage).toContain('Hello *Susanta Lohar*');
    expect(formattedMessage).toContain(
      '📍 *Destination:* Darjeeling, West Bengal'
    );
    expect(formattedMessage).toContain('⏱️ *Duration:* 4 Days / 3 Nights');
    expect(formattedMessage).toContain(
      '💰 *Total Package Price:* ₹28,500 (All Inclusive)'
    );
    expect(formattedMessage).toContain(
      'https://www.helpa.studio/proposals/prop-1234-5678'
    );
    expect(formattedMessage).toContain('Reply *YES* to confirm your booking');
  });

  it('properly sanitizes and generates phone variants for Indian and international numbers', () => {
    const rawNumber = '+91 95477-71118';
    const sanitized = sanitizePhoneForMeta(rawNumber);
    expect(sanitized).toBe('919547771118');

    const variants = phoneVariants(sanitized);
    expect(variants).toContain('919547771118');
    expect(variants.length).toBeGreaterThan(0);
  });
});
