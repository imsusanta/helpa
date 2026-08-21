/**
 * Escapes CSV fields to prevent CSV / Formula Injection attacks (CWE-1236).
 * Formulas starting with =, +, -, @, \t, or \r are prepended with a quote.
 */
export function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';

  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  str = str.replace(/"/g, '""');
  return `"${str}"`;
}
