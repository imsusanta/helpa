type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function moneyValue(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function presentQuotationItem(item: unknown) {
  const row = asRecord(item);
  if (!row) return item;
  const lineTotal = moneyValue(row.line_total ?? row.total);
  return {
    ...row,
    line_total: lineTotal,
    total: lineTotal,
  };
}

export function presentQuotation(quotation: unknown) {
  const row = asRecord(quotation);
  if (!row) return quotation;

  const items = Array.isArray(row.quotation_items)
    ? row.quotation_items.map(presentQuotationItem)
    : row.quotation_items;

  const tax = moneyValue(row.tax_amount ?? row.tax_total);
  const discount = moneyValue(row.discount_amount ?? row.discount_total);

  return {
    ...row,
    tax_amount: tax,
    discount_amount: discount,
    tax_total: moneyValue(row.tax_total ?? row.tax_amount),
    discount_total: moneyValue(row.discount_total ?? row.discount_amount),
    quotation_items: items,
  };
}

export const QUOTATION_ITEMS_FK =
  'quotation_items!quotation_items_quotation_id_fkey';
