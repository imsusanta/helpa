import { test, expect } from '@playwright/test';

test.describe('E2E: Sales CRM Features, Navigation & Security Boundaries', () => {
  test('unauthenticated page requests for sales CRM routes redirect safely to login', async ({
    page,
  }) => {
    const routes = ['/leads', '/customers', '/pipelines', '/quotations', '/invoices'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/(login|signin|$)/);
    }
  });

  test('unauthenticated API calls for sales endpoints fail closed with 401/403', async ({
    request,
  }) => {
    const endpoints = [
      { method: 'get', url: '/api/leads' },
      { method: 'post', url: '/api/leads', data: { name: 'Test Lead' } },
      { method: 'get', url: '/api/customers' },
      { method: 'post', url: '/api/customers', data: { name: 'Test Customer', phone: '+1234567890' } },
      { method: 'get', url: '/api/deals' },
      { method: 'post', url: '/api/deals', data: { name: 'Test Deal', stage_id: '123' } },
      { method: 'get', url: '/api/quotations' },
      { method: 'post', url: '/api/quotations', data: { contact_id: '123', items: [] } },
      { method: 'get', url: '/api/invoices' },
      { method: 'post', url: '/api/invoices', data: { contact_id: '123', items: [] } },
      { method: 'get', url: '/api/tasks' },
      { method: 'post', url: '/api/tasks', data: { title: 'Test Task' } },
      { method: 'post', url: '/api/dashboard/metrics', data: { range: '30d' } },
    ];

    for (const ep of endpoints) {
      const res =
        ep.method === 'get'
          ? await request.get(ep.url)
          : await request.post(ep.url, { data: ep.data });

      expect([401, 403]).toContain(res.status());
      const bodyText = await res.text();
      expect(bodyText).not.toContain('syntax error');
      expect(bodyText).not.toContain('table "');
    }
  });

  test('cross-tenant mutation attempts on Sales resources fail closed', async ({
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000042';

    // Lead stage transition
    const leadStageRes = await request.post(`/api/leads/${fakeId}/stage`, {
      data: { nextStage: 'QUALIFIED' },
    });
    expect([401, 403]).toContain(leadStageRes.status());

    // Lead conversion
    const leadConvertRes = await request.post(`/api/leads/${fakeId}/convert`, {
      data: { createDeal: true },
    });
    expect([401, 403]).toContain(leadConvertRes.status());

    // Quotation status update
    const quoteStatusRes = await request.post(`/api/quotations/${fakeId}/status`, {
      data: { status: 'accepted' },
    });
    expect([401, 403]).toContain(quoteStatusRes.status());

    // Quotation convert to invoice
    const quoteConvertRes = await request.post(
      `/api/quotations/${fakeId}/convert-to-invoice`,
      {}
    );
    expect([401, 403]).toContain(quoteConvertRes.status());

    // Invoice payment record
    const invoicePaymentRes = await request.post(
      `/api/invoices/${fakeId}/payments`,
      {
        data: { amount: 5000, payment_method: 'upi' },
      }
    );
    expect([401, 403]).toContain(invoicePaymentRes.status());
  });
});
