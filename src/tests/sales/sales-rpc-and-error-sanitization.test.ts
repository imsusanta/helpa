import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as convertQuotationPost } from '@/app/api/quotations/[id]/convert-to-invoice/route';
import {
  GET as paymentsGet,
  POST as paymentsPost,
} from '@/app/api/invoices/[id]/payments/route';
import * as accountAuth from '@/lib/auth/account';
import * as serverDb from '@/lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';

const MOCK_ACCOUNT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MOCK_USER_ID = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';
const MOCK_QUOTATION_ID = 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq';
const MOCK_INVOICE_ID = 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii';

describe('Sales RPC & Error Sanitization Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1 & 2: Quotation Conversion RPC Error & Fail-Closed Behavior', () => {
    it('returns 503 SALES_SCHEMA_NOT_READY when RPC is missing (code 42883) and performs no writes', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42883',
          message:
            'function convert_quotation_to_invoice(uuid, uuid, uuid) does not exist',
        },
      });

      const insertMock = vi.fn();
      const updateMock = vi.fn();

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: rpcMock,
        from: () => ({
          insert: insertMock,
          update: updateMock,
        }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/quotations/quote-1/convert-to-invoice',
        {
          method: 'POST',
          headers: { 'x-request-id': 'req-test-503' },
        }
      );

      const res = await convertQuotationPost(req, {
        params: Promise.resolve({ id: MOCK_QUOTATION_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error).toBe('SALES_SCHEMA_NOT_READY');
      expect(body.message).toBe('Sales database migration is not available.');
      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('returns safe 500 without raw DB error text on unknown quotation RPC failure', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'XX000',
          message: 'internal pg crash: lock acquisition failed at 0xdeadbeef',
        },
      });

      const insertMock = vi.fn();

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: rpcMock,
        from: () => ({ insert: insertMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/quotations/quote-1/convert-to-invoice',
        {
          method: 'POST',
        }
      );

      const res = await convertQuotationPost(req, {
        params: Promise.resolve({ id: MOCK_QUOTATION_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('QUOTATION_CONVERSION_FAILED');
      expect(body.message).toBe('Unable to convert quotation.');
      expect(JSON.stringify(body)).not.toContain('0xdeadbeef');
      expect(JSON.stringify(body)).not.toContain('internal pg crash');
      expect(insertMock).not.toHaveBeenCalled();
    });
  });

  describe('3 & 4: Invoice Payment RPC Error & Fail-Closed Behavior', () => {
    it('returns 503 SALES_SCHEMA_NOT_READY when payment RPC is missing and performs no writes', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42883',
          message: 'function record_invoice_payment does not exist',
        },
      });

      const insertMock = vi.fn();
      const updateMock = vi.fn();

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: rpcMock,
        from: () => ({ insert: insertMock, update: updateMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/invoices/inv-1/payments',
        {
          method: 'POST',
          body: JSON.stringify({ amount: 500, payment_method: 'cash' }),
        }
      );

      const res = await paymentsPost(req, {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error).toBe('SALES_SCHEMA_NOT_READY');
      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('returns safe 500 without raw DB error text on unknown payment RPC failure', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: 'XX000',
          message: 'FATAL: disk full on /var/lib/postgresql/data',
        },
      });

      const insertMock = vi.fn();

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: rpcMock,
        from: () => ({ insert: insertMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/invoices/inv-1/payments',
        {
          method: 'POST',
          body: JSON.stringify({ amount: 500 }),
        }
      );

      const res = await paymentsPost(req, {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('PAYMENT_RECORD_FAILED');
      expect(body.message).toBe('Unable to record payment.');
      expect(JSON.stringify(body)).not.toContain('/var/lib/postgresql');
      expect(insertMock).not.toHaveBeenCalled();
    });
  });

  describe('5 & 6: Successful RPC + Hydration Failure Resiliency', () => {
    it('returns 201 with committed invoice data and warning when conversion hydration query fails', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      const rpcMock = vi.fn().mockResolvedValue({
        data: {
          success: true,
          invoice_id: 'inv-committed-999',
          invoice_number: 'INV-2026-0042',
          quotation_id: MOCK_QUOTATION_ID,
        },
        error: null,
      });

      // Hydration query fails
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'connection timeout' },
            }),
          }),
        }),
      });

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: rpcMock,
        from: () => ({ select: selectMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/quotations/quote-1/convert-to-invoice',
        {
          method: 'POST',
        }
      );

      const res = await convertQuotationPost(req, {
        params: Promise.resolve({ id: MOCK_QUOTATION_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('inv-committed-999');
      expect(body.data.invoice_number).toBe('INV-2026-0042');
      expect(body.warning).toBe('INVOICE_DETAILS_REFRESH_REQUIRED');
      expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('returns 201 with committed payment data and warning when payment hydration query fails', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      const rpcMock = vi.fn().mockResolvedValue({
        data: {
          success: true,
          payment_id: 'pay-committed-123',
          invoice_id: MOCK_INVOICE_ID,
          amount_paid: 2500,
          balance_due: 0,
          status: 'paid',
          currency: 'INR',
        },
        error: null,
      });

      // Hydration query fails
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '57014', message: 'query canceled' },
            }),
          }),
        }),
      });

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: rpcMock,
        from: () => ({ select: selectMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/invoices/inv-1/payments',
        {
          method: 'POST',
          body: JSON.stringify({ amount: 2500 }),
        }
      );

      const res = await paymentsPost(req, {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.payment_id).toBe('pay-committed-123');
      expect(body.data.amount_paid).toBe(2500);
      expect(body.data.balance_due).toBe(0);
      expect(body.data.status).toBe('paid');
      expect(body.warning).toBe('INVOICE_DETAILS_REFRESH_REQUIRED');
      expect(rpcMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('7: Payment Domain Errors Sanitize Raw DB Errors', () => {
    it('maps OVERPAYMENT_NOT_ALLOWED to 409 with curated message', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '22023',
            message:
              'OVERPAYMENT_NOT_ALLOWED: Payment exceeds total balance due of 100.00',
          },
        }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/invoices/inv-1/payments',
        {
          method: 'POST',
          body: JSON.stringify({ amount: 500 }),
        }
      );

      const res = await paymentsPost(req, {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('OVERPAYMENT_NOT_ALLOWED');
      expect(body.message).toBe(
        'Payment exceeds the remaining invoice balance.'
      );
    });

    it('maps INVOICE_VOID to 409 with curated message', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'agent',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '22023',
            message:
              'INVOICE_VOID: Cannot record payment against a void invoice.',
          },
        }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/invoices/inv-1/payments',
        {
          method: 'POST',
          body: JSON.stringify({ amount: 500 }),
        }
      );

      const res = await paymentsPost(req, {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe('INVOICE_VOID');
      expect(body.message).toBe(
        'Payments cannot be recorded for a void invoice.'
      );
    });

    it('sanitizes GET /api/invoices/[id]/payments error output', async () => {
      vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'viewer',
      } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);

      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  error: {
                    code: '42P01',
                    message: 'relation "invoice_payments" does not exist',
                  },
                }),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const req = new NextRequest(
        'http://localhost/api/invoices/inv-1/payments',
        {
          method: 'GET',
        }
      );

      const res = await paymentsGet(req, {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('PAYMENTS_FETCH_FAILED');
      expect(body.message).toBe('Unable to load invoice payments.');
      expect(JSON.stringify(body)).not.toContain('42P01');
      expect(JSON.stringify(body)).not.toContain('relation');
    });
  });

  describe('8, 9, 10, 11: Schema Migration RPC Security & Constraints Audit', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260822150000_sales_crm_complete_schema.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    it('declares security definer and search_path on all accounting RPCs', () => {
      const rpcNames = [
        'generate_next_quotation_number',
        'generate_next_invoice_number',
        'convert_quotation_to_invoice',
        'record_invoice_payment',
      ];

      for (const rpc of rpcNames) {
        expect(sqlContent).toContain(`function public.${rpc}`);
      }

      const secDefinerCount = (sqlContent.match(/security definer/gi) || [])
        .length;
      expect(secDefinerCount).toBeGreaterThanOrEqual(4);

      const searchPathCount = (
        sqlContent.match(/set search_path = public, pg_temp/gi) || []
      ).length;
      expect(searchPathCount).toBeGreaterThanOrEqual(4);
    });

    it('revokes execute from public and authenticated, granting only to service_role', () => {
      const rpcSignatures = [
        'public.generate_next_quotation_number(uuid)',
        'public.generate_next_invoice_number(uuid)',
        'public.convert_quotation_to_invoice(uuid, uuid, uuid)',
        'public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid)',
      ];

      for (const sig of rpcSignatures) {
        expect(sqlContent).toContain(
          `revoke all on function ${sig} from public;`
        );
        expect(sqlContent).toContain(
          `revoke all on function ${sig} from authenticated;`
        );
        expect(sqlContent).toContain(
          `grant execute on function ${sig} to service_role;`
        );
      }
    });

    it('verifies user membership and account existence inside RPC bodies', () => {
      expect(sqlContent).toContain(
        'if not exists (select 1 from public.accounts where id = p_account_id)'
      );
      expect(sqlContent).toContain('select 1 from public.account_members');
      expect(sqlContent).toContain("role in ('owner', 'admin', 'agent')");
    });
  });
});
