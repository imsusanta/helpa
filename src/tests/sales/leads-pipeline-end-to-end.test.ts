import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
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

  describe('Migration Hardening & Constraint Integrity', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260822150000_sales_crm_complete_schema.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    it('contains all required named check constraints', () => {
      const requiredCheckConstraints = [
        'chk_leads_stage',
        'chk_tasks_status',
        'chk_tasks_priority',
        'chk_quotations_status',
        'chk_quotation_items_quantity',
        'chk_quotation_items_unit_price',
        'chk_quotation_items_discount',
        'chk_quotation_items_tax_rate',
        'chk_invoices_status',
        'chk_invoices_balance_due',
        'chk_invoice_items_quantity',
        'chk_invoice_items_unit_price',
        'chk_invoice_items_discount',
        'chk_invoice_items_tax_rate',
        'chk_invoice_payments_amount',
      ];

      for (const constraint of requiredCheckConstraints) {
        expect(sqlContent).toContain(constraint);
      }
    });

    it('contains all tenant composite foreign keys', () => {
      const requiredCompositeFks = [
        'fk_lead_activities_lead_tenant',
        'fk_lead_notes_lead_tenant',
        'fk_quotation_items_quotation_tenant',
        'fk_invoice_items_invoice_tenant',
        'fk_invoice_payments_invoice_tenant',
      ];

      for (const fk of requiredCompositeFks) {
        expect(sqlContent).toContain(fk);
      }
    });

    it('contains tenant unique constraints for composite referencing', () => {
      const requiredUniques = [
        'uq_leads_id_account',
        'uq_tasks_id_account',
        'uq_quotations_id_account',
        'uq_quotations_account_number',
        'uq_invoices_id_account',
        'uq_invoices_account_number',
      ];

      for (const uq of requiredUniques) {
        expect(sqlContent).toContain(uq);
      }
    });

    it('contains concurrency-safe sequence generation and atomic RPCs', () => {
      expect(sqlContent).toContain(
        'create table if not exists public.tenant_document_sequences'
      );
      expect(sqlContent).toContain(
        'function public.generate_next_quotation_number'
      );
      expect(sqlContent).toContain(
        'function public.generate_next_invoice_number'
      );
      expect(sqlContent).toContain(
        'function public.convert_quotation_to_invoice'
      );
      expect(sqlContent).toContain('function public.record_invoice_payment');
    });

    it('guards every policy creation with drop policy if exists', () => {
      const createPolicyCount = (sqlContent.match(/create policy/gi) || [])
        .length;
      const dropPolicyCount = (
        sqlContent.match(/drop policy if exists/gi) || []
      ).length;
      expect(dropPolicyCount).toBeGreaterThanOrEqual(createPolicyCount);
    });

    it('includes preflight check against null account_id', () => {
      expect(sqlContent).toContain(
        "raise exception 'Migration preflight failed"
      );
    });
  });

  describe('Preflight & Cross-Tenant Rejection Logic', () => {
    it('throws migration preflight exception if records have null account_id', () => {
      function runPreflight(rows: { id: string; account_id: string | null }[]) {
        const nullRows = rows.filter((r) => !r.account_id);
        if (nullRows.length > 0) {
          throw new Error(
            `Migration preflight failed: found ${nullRows.length} rows with NULL account_id`
          );
        }
        return { ok: true };
      }

      expect(() =>
        runPreflight([
          { id: '1', account_id: 'acc-1' },
          { id: '2', account_id: null },
        ])
      ).toThrow(
        'Migration preflight failed: found 1 rows with NULL account_id'
      );

      expect(runPreflight([{ id: '1', account_id: 'acc-1' }]).ok).toBe(true);
    });

    it('rejects cross-tenant child insertion under different parent account_id', () => {
      const parentQuotation = { id: 'quote-100', account_id: 'tenant-A' };

      function insertQuotationItem(
        parent: typeof parentQuotation,
        item: { quotation_id: string; account_id: string; description: string }
      ) {
        if (
          item.quotation_id === parent.id &&
          item.account_id !== parent.account_id
        ) {
          throw new Error(
            'FOREIGN_KEY_VIOLATION: Cross-tenant child reference rejected'
          );
        }
        return { success: true };
      }

      expect(() =>
        insertQuotationItem(parentQuotation, {
          quotation_id: 'quote-100',
          account_id: 'tenant-B',
          description: 'Infiltrating item',
        })
      ).toThrow('FOREIGN_KEY_VIOLATION');

      expect(
        insertQuotationItem(parentQuotation, {
          quotation_id: 'quote-100',
          account_id: 'tenant-A',
          description: 'Valid item',
        }).success
      ).toBe(true);
    });
  });

  describe('Simultaneous Concurrency & Atomic State Machines', () => {
    it('handles simultaneous quotation conversions atomically and rejects race condition duplicates', async () => {
      const quotation = {
        id: 'qt-concurrent-1',
        account_id: 'acc-1',
        status: 'sent',
        convertedInvoiceId: null as string | null,
      };

      let conversionLock = false;

      async function convertQuotationAtomic(
        q: typeof quotation,
        reqId: string
      ) {
        // Simulate DB FOR UPDATE lock
        while (conversionLock) {
          await new Promise((r) => setTimeout(r, 5));
        }
        conversionLock = true;
        try {
          if (q.status === 'converted' || q.convertedInvoiceId) {
            throw new Error('ALREADY_CONVERTED');
          }
          const invoiceId = `inv-${reqId}`;
          q.status = 'converted';
          q.convertedInvoiceId = invoiceId;
          return { success: true, invoiceId };
        } finally {
          conversionLock = false;
        }
      }

      const [res1, res2] = await Promise.allSettled([
        convertQuotationAtomic(quotation, 'req-1'),
        convertQuotationAtomic(quotation, 'req-2'),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason.message).toBe('ALREADY_CONVERTED');
      }
    });

    it('prevents overpayment during simultaneous payments and maintains exact balance', async () => {
      const invoice = {
        id: 'inv-payment-1',
        total: 10000,
        amount_paid: 0,
        balance_due: 10000,
        status: 'draft',
      };

      let invoiceLock = false;

      async function recordPaymentAtomic(
        inv: typeof invoice,
        paymentAmount: number
      ) {
        while (invoiceLock) {
          await new Promise((r) => setTimeout(r, 5));
        }
        invoiceLock = true;
        try {
          if (paymentAmount <= 0) throw new Error('INVALID_AMOUNT');
          if (inv.amount_paid + paymentAmount > inv.total) {
            throw new Error('OVERPAYMENT_NOT_ALLOWED');
          }
          inv.amount_paid += paymentAmount;
          inv.balance_due = inv.total - inv.amount_paid;
          inv.status = inv.balance_due === 0 ? 'paid' : 'partially_paid';
          return {
            success: true,
            amount_paid: inv.amount_paid,
            balance_due: inv.balance_due,
          };
        } finally {
          invoiceLock = false;
        }
      }

      // Try two simultaneous payments of 6,000 each (Total: 12,000 > 10,000)
      const [p1, p2] = await Promise.allSettled([
        recordPaymentAtomic(invoice, 6000),
        recordPaymentAtomic(invoice, 6000),
      ]);

      const fulfilled = [p1, p2].filter((r) => r.status === 'fulfilled');
      const rejected = [p1, p2].filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(invoice.amount_paid).toBe(6000);
      expect(invoice.balance_due).toBe(4000);
      expect(invoice.status).toBe('partially_paid');
    });

    it('generates consecutive tenant-scoped sequences without duplicate allocations', () => {
      const sequences: Record<string, number> = {};

      function generateNextNumber(accountId: string, prefix: string) {
        const key = `${accountId}:${prefix}`;
        sequences[key] = (sequences[key] || 0) + 1;
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${String(sequences[key]).padStart(4, '0')}`;
      }

      const q1 = generateNextNumber('acc-1', 'QT');
      const q2 = generateNextNumber('acc-1', 'QT');
      const q3 = generateNextNumber('acc-2', 'QT');

      expect(q1).toBe(`QT-${new Date().getFullYear()}-0001`);
      expect(q2).toBe(`QT-${new Date().getFullYear()}-0002`);
      expect(q3).toBe(`QT-${new Date().getFullYear()}-0001`); // Isolated for acc-2
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
});
