import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GET as paymentsGet,
  POST as paymentsPost,
} from '@/app/api/invoices/[id]/payments/route';
import { POST as convertQuotationPost } from '@/app/api/quotations/[id]/convert-to-invoice/route';
import * as accountAuth from '@/lib/auth/account';
import * as travelAccess from '@/lib/travel/access';
import * as serverDb from '@/lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';

const MOCK_ACCOUNT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MOCK_USER_ID = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';
const MOCK_QUOTATION_ID = 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq';
const MOCK_INVOICE_ID = 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii';

function mockAgentRole(): void {
  vi.spyOn(accountAuth, 'requireRole').mockResolvedValue({
    accountId: MOCK_ACCOUNT_ID,
    userId: MOCK_USER_ID,
    role: 'agent',
  } as unknown as Awaited<ReturnType<typeof accountAuth.requireRole>>);
  vi.spyOn(travelAccess, 'requireTravelWorkplace').mockResolvedValue({
    accountId: MOCK_ACCOUNT_ID,
    userId: MOCK_USER_ID,
    role: 'agent',
  } as unknown as Awaited<
    ReturnType<typeof travelAccess.requireTravelWorkplace>
  >);
}

function paymentRequest(amount = 500): NextRequest {
  return new NextRequest('http://localhost/api/invoices/inv-1/payments', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

function conversionRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/quotations/quote-1/convert-to-invoice',
    { method: 'POST' }
  );
}

describe('Sales RPC & Error Sanitization Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quotation conversion fails closed', () => {
    it('returns 503 when the RPC is missing and performs no writes', async () => {
      mockAgentRole();
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
        from: () => ({ insert: insertMock, update: updateMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const res = await convertQuotationPost(conversionRequest(), {
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

    it('sanitizes unknown RPC errors', async () => {
      mockAgentRole();
      const insertMock = vi.fn();
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'XX000',
            message: 'internal pg crash: lock acquisition failed at 0xdeadbeef',
          },
        }),
        from: () => ({ insert: insertMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const res = await convertQuotationPost(conversionRequest(), {
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

  describe('invoice payments fail closed', () => {
    it('returns 503 when the RPC is missing and performs no writes', async () => {
      mockAgentRole();
      const insertMock = vi.fn();
      const updateMock = vi.fn();
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '42883',
            message: 'function record_invoice_payment does not exist',
          },
        }),
        from: () => ({ insert: insertMock, update: updateMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const res = await paymentsPost(paymentRequest(), {
        params: Promise.resolve({ id: MOCK_INVOICE_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error).toBe('SALES_SCHEMA_NOT_READY');
      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('sanitizes unknown RPC errors', async () => {
      mockAgentRole();
      const insertMock = vi.fn();
      vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'XX000',
            message: 'FATAL: disk full on /var/lib/postgresql/data',
          },
        }),
        from: () => ({ insert: insertMock }),
      } as unknown as ReturnType<typeof serverDb.getAdminClient>);

      const res = await paymentsPost(paymentRequest(), {
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

  describe('post-commit hydration failures', () => {
    it('returns committed invoice data without retrying the RPC', async () => {
      mockAgentRole();
      const rpcMock = vi.fn().mockResolvedValue({
        data: {
          success: true,
          invoice_id: 'inv-committed-999',
          invoice_number: 'INV-2026-0042',
          quotation_id: MOCK_QUOTATION_ID,
        },
        error: null,
      });
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

      const res = await convertQuotationPost(conversionRequest(), {
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

    it('returns committed payment data without retrying the RPC', async () => {
      mockAgentRole();
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

      const res = await paymentsPost(paymentRequest(2500), {
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

  describe('payment domain errors', () => {
    it.each([
      [
        'OVERPAYMENT_NOT_ALLOWED: Payment exceeds total balance due of 100.00',
        'OVERPAYMENT_NOT_ALLOWED',
        'Payment exceeds the remaining invoice balance.',
      ],
      [
        'INVOICE_VOID: Cannot record payment against a void invoice.',
        'INVOICE_VOID',
        'Payments cannot be recorded for a void invoice.',
      ],
    ])(
      'maps %s to a safe conflict response',
      async (message, code, safeMessage) => {
        mockAgentRole();
        vi.spyOn(serverDb, 'getAdminClient').mockReturnValue({
          rpc: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '22023', message },
          }),
        } as unknown as ReturnType<typeof serverDb.getAdminClient>);

        const res = await paymentsPost(paymentRequest(), {
          params: Promise.resolve({ id: MOCK_INVOICE_ID }),
        });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.error).toBe(code);
        expect(body.message).toBe(safeMessage);
      }
    );

    it('sanitizes payment-list query errors', async () => {
      vi.spyOn(travelAccess, 'requireTravelWorkplace').mockResolvedValue({
        accountId: MOCK_ACCOUNT_ID,
        userId: MOCK_USER_ID,
        role: 'viewer',
      } as unknown as Awaited<
        ReturnType<typeof travelAccess.requireTravelWorkplace>
      >);
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
        { method: 'GET' }
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

  describe('schema migration RPC security', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260822150000_sales_crm_complete_schema.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    it('uses security definer and a fixed search path', () => {
      const rpcNames = [
        'generate_next_quotation_number',
        'generate_next_invoice_number',
        'convert_quotation_to_invoice',
        'record_invoice_payment',
      ];
      for (const rpc of rpcNames) {
        expect(sqlContent).toContain(`function public.${rpc}`);
      }
      expect(
        (sqlContent.match(/security definer/gi) || []).length
      ).toBeGreaterThanOrEqual(4);
      expect(
        (sqlContent.match(/set search_path = public, pg_temp/gi) || []).length
      ).toBeGreaterThanOrEqual(4);
    });

    it('grants execution only to the service role', () => {
      const signatures = [
        'public.generate_next_quotation_number(uuid)',
        'public.generate_next_invoice_number(uuid)',
        'public.convert_quotation_to_invoice(uuid, uuid, uuid)',
        'public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid)',
      ];
      for (const signature of signatures) {
        expect(sqlContent).toContain(
          `revoke all on function ${signature} from public;`
        );
        expect(sqlContent).toContain(
          `revoke all on function ${signature} from authenticated;`
        );
        expect(sqlContent).toContain(
          `grant execute on function ${signature} to service_role;`
        );
      }
    });

    it('verifies account existence and user membership', () => {
      expect(sqlContent).toContain(
        'if not exists (select 1 from public.accounts where id = p_account_id)'
      );
      expect(sqlContent).toContain('select 1 from public.account_members');
      expect(sqlContent).toContain("role in ('owner', 'admin', 'agent')");
    });
  });
});
