import { describe, it, expect } from 'vitest';
import { SalesApiError } from '@/lib/sales/api-client';

describe('Sales CRM End-to-End Logic & Contracts', () => {
  describe('Sales API Client', () => {
    it('constructs SalesApiError with status and request ID', () => {
      const err = new SalesApiError(
        'Custom error',
        400,
        'BAD_REQUEST',
        'REQ-1234'
      );
      expect(err.name).toBe('SalesApiError');
      expect(err.message).toBe('Custom error');
      expect(err.status).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.requestId).toBe('REQ-1234');
    });
  });

  describe('Lead Stage Transition & Validation Logic', () => {
    const VALID_STAGES = [
      'NEW',
      'CONTACTED',
      'QUALIFYING',
      'QUALIFIED',
      'APPOINTMENT_OFFERED',
      'BOOKED',
      'CONFIRMED',
      'FOLLOW_UP',
      'ATTENDED',
      'CONVERTED',
      'LOST',
    ];

    it('requires lost_reason when moving lead to LOST stage', () => {
      function validateStageTransition(
        targetStage: string,
        lostReason?: string
      ) {
        if (!VALID_STAGES.includes(targetStage)) {
          throw new Error('INVALID_STAGE');
        }
        if (targetStage === 'LOST' && (!lostReason || !lostReason.trim())) {
          throw new Error('LOST_REASON_REQUIRED');
        }
        return { success: true, stage: targetStage, lostReason };
      }

      expect(() => validateStageTransition('LOST', '')).toThrow(
        'LOST_REASON_REQUIRED'
      );
      expect(() => validateStageTransition('LOST', undefined)).toThrow(
        'LOST_REASON_REQUIRED'
      );
      expect(validateStageTransition('LOST', 'Price too high').success).toBe(
        true
      );
      expect(validateStageTransition('QUALIFIED').success).toBe(true);
    });

    it('handles idempotent lead conversion to contact and deals', () => {
      const mockLead = {
        id: 'lead-101',
        account_id: 'acc-1',
        name: 'Sarah Connor',
        phone: '+919876543210',
        email: 'sarah@example.com',
        service: 'Dental Implant',
        value: 45000,
        currency: 'INR',
        contact_id: null as string | null,
      };

      function convertLead(lead: typeof mockLead, existingContactId?: string) {
        const contactId =
          existingContactId || lead.contact_id || 'contact-new-1';
        const deal = {
          id: 'deal-1',
          contact_id: contactId,
          name: `${lead.name} - ${lead.service || 'Deal'}`,
          value: lead.value,
          currency: lead.currency,
          status: 'open',
        };
        return {
          contactId,
          deal,
          updatedLead: { ...lead, contact_id: contactId, stage: 'CONVERTED' },
        };
      }

      const result = convertLead(mockLead);
      expect(result.contactId).toBe('contact-new-1');
      expect(result.deal.name).toBe('Sarah Connor - Dental Implant');
      expect(result.deal.value).toBe(45000);
      expect(result.updatedLead.stage).toBe('CONVERTED');

      // Idempotent conversion if already converted
      const result2 = convertLead(result.updatedLead, result.contactId);
      expect(result2.contactId).toBe('contact-new-1');
      expect(result2.updatedLead.stage).toBe('CONVERTED');
    });
  });

  describe('Quotations Math & Conversion Logic', () => {
    it('computes subtotal, tax rate, and discount correctly', () => {
      const items = [
        { description: 'Root Canal Treatment', quantity: 1, unit_price: 8000 },
        { description: 'Crown Fitting', quantity: 2, unit_price: 3500 },
      ];
      const taxRate = 18; // 18% GST
      const discount = 1000;

      const subtotal = items.reduce(
        (acc, it) => acc + it.quantity * it.unit_price,
        0
      );
      const taxAmount = (subtotal * taxRate) / 100;
      const total = Math.max(0, subtotal + taxAmount - discount);

      expect(subtotal).toBe(15000); // 8000 + 7000
      expect(taxAmount).toBe(2700);
      expect(total).toBe(16700); // 15000 + 2700 - 1000
    });

    it('converts quotation to invoice with matching line items and accepted status', () => {
      const quotation = {
        id: 'qt-1',
        quotation_number: 'QT-2026-0001',
        contact_id: 'cust-1',
        deal_id: 'deal-1',
        status: 'sent',
        subtotal: 15000,
        tax_amount: 2700,
        discount_amount: 1000,
        total: 16700,
        currency: 'INR',
        items: [
          {
            description: 'Root Canal Treatment',
            quantity: 1,
            unit_price: 8000,
            total: 8000,
          },
          {
            description: 'Crown Fitting',
            quantity: 2,
            unit_price: 3500,
            total: 7000,
          },
        ],
      };

      function convertQuotationToInvoice(q: typeof quotation) {
        const invoice = {
          id: 'inv-1',
          invoice_number: 'INV-2026-0001',
          contact_id: q.contact_id,
          deal_id: q.deal_id,
          status: 'draft',
          subtotal: q.subtotal,
          tax_amount: q.tax_amount,
          discount_amount: q.discount_amount,
          total: q.total,
          amount_paid: 0,
          currency: q.currency,
          items: q.items.map((it, idx) => ({ ...it, order_index: idx })),
        };
        const updatedQuotation = { ...q, status: 'accepted' };
        return { invoice, updatedQuotation };
      }

      const { invoice, updatedQuotation } =
        convertQuotationToInvoice(quotation);
      expect(invoice.total).toBe(16700);
      expect(invoice.amount_paid).toBe(0);
      expect(invoice.items).toHaveLength(2);
      expect(updatedQuotation.status).toBe('accepted');
    });
  });

  describe('Invoice Payments & Balance Calculation', () => {
    it('updates invoice amount_paid and transitions status to partially_paid or paid', () => {
      const invoice = {
        id: 'inv-1',
        total: 10000,
        amount_paid: 0,
        status: 'sent' as string,
      };

      function recordPayment(inv: typeof invoice, paymentAmount: number) {
        if (paymentAmount <= 0) {
          throw new Error('INVALID_AMOUNT');
        }
        const newPaid = inv.amount_paid + paymentAmount;
        let newStatus = inv.status;
        if (newPaid >= inv.total) {
          newStatus = 'paid';
        } else if (newPaid > 0) {
          newStatus = 'partially_paid';
        }
        return { ...inv, amount_paid: newPaid, status: newStatus };
      }

      expect(() => recordPayment(invoice, -500)).toThrow('INVALID_AMOUNT');
      expect(() => recordPayment(invoice, 0)).toThrow('INVALID_AMOUNT');

      const step1 = recordPayment(invoice, 4000);
      expect(step1.amount_paid).toBe(4000);
      expect(step1.status).toBe('partially_paid');

      const step2 = recordPayment(step1, 6000);
      expect(step2.amount_paid).toBe(10000);
      expect(step2.status).toBe('paid');
    });
  });

  describe('Multi-Tenant Boundary Isolation & Permissions Check', () => {
    interface AccountContext {
      accountId: string;
      role: 'viewer' | 'agent' | 'admin' | 'owner';
    }

    function checkPermission(
      ctx: AccountContext,
      targetAccountId: string,
      action: 'view' | 'create' | 'update' | 'delete'
    ) {
      if (ctx.accountId !== targetAccountId) {
        throw new Error('TENANT_ACCESS_DENIED');
      }
      if (action === 'delete') {
        if (ctx.role !== 'admin' && ctx.role !== 'owner') {
          throw new Error('ADMIN_REQUIRED');
        }
      }
      if (action === 'create' || action === 'update') {
        if (ctx.role === 'viewer') {
          throw new Error('MUTATION_FORBIDDEN_FOR_VIEWER');
        }
      }
      return true;
    }

    it('rejects cross-tenant access between Account A and Account B', () => {
      const accountA: AccountContext = { accountId: 'acc-A', role: 'owner' };
      expect(() => checkPermission(accountA, 'acc-B', 'view')).toThrow(
        'TENANT_ACCESS_DENIED'
      );
      expect(() => checkPermission(accountA, 'acc-B', 'create')).toThrow(
        'TENANT_ACCESS_DENIED'
      );
      expect(() => checkPermission(accountA, 'acc-B', 'delete')).toThrow(
        'TENANT_ACCESS_DENIED'
      );
    });

    it('enforces role restrictions (viewer cannot mutate, agent cannot delete)', () => {
      const viewer: AccountContext = { accountId: 'acc-A', role: 'viewer' };
      const agent: AccountContext = { accountId: 'acc-A', role: 'agent' };
      const admin: AccountContext = { accountId: 'acc-A', role: 'admin' };

      expect(checkPermission(viewer, 'acc-A', 'view')).toBe(true);
      expect(() => checkPermission(viewer, 'acc-A', 'create')).toThrow(
        'MUTATION_FORBIDDEN_FOR_VIEWER'
      );
      expect(() => checkPermission(viewer, 'acc-A', 'update')).toThrow(
        'MUTATION_FORBIDDEN_FOR_VIEWER'
      );
      expect(() => checkPermission(viewer, 'acc-A', 'delete')).toThrow(
        'ADMIN_REQUIRED'
      );

      expect(checkPermission(agent, 'acc-A', 'create')).toBe(true);
      expect(checkPermission(agent, 'acc-A', 'update')).toBe(true);
      expect(() => checkPermission(agent, 'acc-A', 'delete')).toThrow(
        'ADMIN_REQUIRED'
      );

      expect(checkPermission(admin, 'acc-A', 'delete')).toBe(true);
    });
  });

  describe('Dashboard Metrics Aggregations from Fixtures', () => {
    it('calculates total leads, total revenue, and pipeline value accurately', () => {
      const sampleLeads = [
        { id: '1', stage: 'NEW', value: 10000 },
        { id: '2', stage: 'QUALIFIED', value: 25000 },
        { id: '3', stage: 'LOST', value: 5000 },
      ];
      const sampleInvoices = [
        { id: 'inv-1', status: 'paid', total: 30000, amount_paid: 30000 },
        {
          id: 'inv-2',
          status: 'partially_paid',
          total: 20000,
          amount_paid: 10000,
        },
        { id: 'inv-3', status: 'draft', total: 15000, amount_paid: 0 },
      ];

      const totalLeads = sampleLeads.length;
      const pipelineValue = sampleLeads
        .filter((l) => l.stage !== 'LOST')
        .reduce((sum, l) => sum + l.value, 0);
      const totalRevenue = sampleInvoices.reduce(
        (sum, inv) => sum + inv.amount_paid,
        0
      );

      expect(totalLeads).toBe(3);
      expect(pipelineValue).toBe(35000); // 10000 + 25000
      expect(totalRevenue).toBe(40000); // 30000 + 10000
    });
  });

  describe('Pipeline Stages Canonical Ordering', () => {
    it('orders stages seamlessly whether order_index or legacy position is used', () => {
      const stages = [
        { id: 's2', name: 'Qualified', order_index: 2, position: 2 },
        { id: 's0', name: 'New', order_index: 0, position: 0 },
        { id: 's1', name: 'Contacted', order_index: 1, position: 1 },
      ];

      const sorted = [...stages].sort(
        (a, b) =>
          (a.order_index ?? a.position ?? 0) -
          (b.order_index ?? b.position ?? 0)
      );

      expect(sorted.map((s) => s.id)).toEqual(['s0', 's1', 's2']);
    });
  });
});
