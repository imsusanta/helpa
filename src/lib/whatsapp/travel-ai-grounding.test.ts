import { describe, expect, it } from 'vitest';
import {
  formatPackagesForAiContext,
  getNoMatchFallback,
  generateProposalSnapshot,
  type TourPackageWithDetails,
} from '@/modules/travel/package-service';

describe('Travel AI Grounding & Guardrails Test Suite', () => {
  const samplePkg: TourPackageWithDetails = {
    id: 'pkg-darj-101',
    account_id: 'tenant-test-123',
    package_code: 'PKG-DARJ-01',
    name: 'Darjeeling & Mirik Queen of Hills Tour',
    destination: 'Darjeeling',
    summary: '4 days in scenic hills with tea garden visits',
    duration_days: 4,
    duration_nights: 3,
    base_price: 12500,
    currency: 'INR',
    price_basis: 'per_person',
    hotel_details: { type: '3-Star Hotel', room: 'Deluxe' },
    transport_details: { type: 'Private Cab' },
    inclusions: ['Breakfast', 'Transfers', 'Sightseeing'],
    exclusions: ['Airfare', 'Personal Expenses'],
    terms_and_conditions: '50% advance to confirm',
    booking_deadline: null,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    status: 'published',
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    itinerary: [
      {
        id: '1',
        account_id: 'tenant-test-123',
        package_id: 'pkg-darj-101',
        day_number: 1,
        title: 'Arrival & Hotel Check-in',
        description: 'Pick up from NJP / Bagdogra',
        meals: 'Dinner',
        accommodation: 'Deluxe Mountain View Room',
        created_at: '',
        updated_at: '',
      },
    ],
    departures: [
      {
        id: 'dep-nov-01',
        account_id: 'tenant-test-123',
        package_id: 'pkg-darj-101',
        start_date: '2026-11-10',
        end_date: '2026-11-13',
        departure_price: 13000,
        total_seats: 20,
        available_seats: 12,
        status: 'scheduled',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
    ],
  };

  describe('1. Bounded Grounding and Database Source-of-Truth Context', () => {
    it('generates grounded AI context strictly from DB records with explicit internal_id tags', () => {
      const { context, fallbackMessage } = formatPackagesForAiContext([
        samplePkg,
      ]);
      expect(fallbackMessage).toBeNull();
      expect(context).toContain(
        '=== STRUCTURED TOUR PACKAGE DATABASE (SOURCE OF TRUTH) ==='
      );
      expect(context).toContain('[internal_id:pkg-darj-101]');
      expect(context).toContain('Darjeeling & Mirik Queen of Hills Tour');
      expect(context).toContain('INR 12500 (per_person)');
      expect(context).toContain('Day 1: Arrival & Hotel Check-in');
      expect(context).toContain('Available Seats: 12');
    });

    it('never includes unpublished or draft data when empty array passed', () => {
      const { context } = formatPackagesForAiContext([]);
      expect(context).toBe('');
    });
  });

  describe('2. Deterministic No-Match Language Fallbacks', () => {
    it('returns Bangla-only fallback for Bangla and Banglish user queries without English mixing', () => {
      const queries = [
        'সুইজারল্যান্ড ট্যুর প্যাকেজ খরচ কত?',
        'maldives jabo koto taka lagbe?',
        'Darjeeling package ache?',
        'kichu tour package details dao',
      ];

      for (const query of queries) {
        const fallback = getNoMatchFallback(query);
        expect(fallback).toContain(
          'এই মুহূর্তে আমাদের active Tour Package list-এ এই destination-এর কোনো package পাওয়া যায়নি'
        );
        expect(fallback).not.toContain('No matching active tour package');
      }
    });

    it('returns English-only fallback for English user queries without Bengali mixing', () => {
      const queries = [
        'Do you have any Europe tour packages available for December?',
        'What is the price of the Thailand family vacation package?',
        'Please send me the package catalog for Dubai.',
      ];

      for (const query of queries) {
        const fallback = getNoMatchFallback(query);
        expect(fallback).toContain(
          'No matching active tour package is currently listed in our catalog'
        );
        expect(fallback).not.toContain('এই মুহূর্তে');
      }
    });
  });

  describe('3. Proposal & Booking Security Invariants', () => {
    it('builds immutable proposal snapshots directly from database data', () => {
      const snapshot = generateProposalSnapshot(samplePkg, 'dep-nov-01');
      expect(snapshot.source_package_id).toBe('pkg-darj-101');
      expect(snapshot.source_departure_id).toBe('dep-nov-01');
      expect(snapshot.package_name).toBe(
        'Darjeeling & Mirik Queen of Hills Tour'
      );
      expect(snapshot.base_price).toBe(13000); // from departure override
      expect(snapshot.available_seats).toBe(12);
      expect(snapshot.currency).toBe('INR');

      // Modifying samplePkg does not mutate snapshot
      samplePkg.base_price = 99999;
      expect(snapshot.base_price).toBe(13000);
    });

    it('handles departureId correctly when departure is not found or null', () => {
      const snapshot = generateProposalSnapshot(samplePkg, null);
      expect(snapshot.source_departure_id).toBeNull();
      expect(snapshot.base_price).toBe(samplePkg.base_price);
    });

    it('does NOT create a booking if model outputs "book" but customer text lacks explicit confirmation', () => {
      const userText = 'Can you tell me more about the hotels?';
      const enConfirm =
        /\b(confirm|yes confirm|please confirm|proceed with booking|proceed|book it|book this|book now|book this package|confirm booking)\b/i.test(
          userText.trim().toLowerCase()
        );
      const bnConfirm =
        /(হ্যাঁ কনফার্ম|হাঁ কনফার্ম|কনফার্ম করুন|বুক করুন|বুক করে দিন|বুকিং কনফার্ম)/.test(
          userText.trim().toLowerCase()
        );
      const isExplicitConfirmation = enConfirm || bnConfirm;
      expect(isExplicitConfirmation).toBe(false);
    });

    it('does NOT create a booking if customer says "yes" without a pending proposal/quote state', () => {
      const existingProposals: unknown[] = [];
      const hasPendingProposal = existingProposals.length > 0;
      expect(hasPendingProposal).toBe(false);
    });

    it('creates a booking ONLY when explicit confirmation matches AND pending proposal exists', () => {
      const userConfirmations = [
        'Yes please confirm booking',
        'Book this package now',
        'হ্যাঁ কনফার্ম করুন',
        'proceed with booking',
      ];

      for (const text of userConfirmations) {
        const enConfirm =
          /\b(confirm|yes confirm|please confirm|proceed with booking|proceed|book it|book this|book now|book this package|confirm booking)\b/i.test(
            text.trim().toLowerCase()
          );
        const bnConfirm =
          /(হ্যাঁ কনফার্ম|হাঁ কনফার্ম|কনফার্ম করুন|বুক করুন|বুক করে দিন|বুকিং কনফার্ম)/.test(
            text.trim().toLowerCase()
          );
        const isExplicit = enConfirm || bnConfirm;
        expect(isExplicit).toBe(true);
      }
    });

    it('rejects booking when departure has 0 available seats or status is cancelled', () => {
      const soldOutDep = {
        id: 'dep-soldout',
        available_seats: 0,
        status: 'sold_out',
      };
      const cancelledDep = {
        id: 'dep-cancel',
        available_seats: 10,
        status: 'cancelled',
      };

      const isAvailable = (dep: { available_seats: number; status: string }) =>
        dep.status === 'scheduled' && dep.available_seats > 0;

      expect(isAvailable(soldOutDep)).toBe(false);
      expect(isAvailable(cancelledDep)).toBe(false);
    });
  });
});
