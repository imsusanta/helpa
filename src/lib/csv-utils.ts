/**
 * Escapes CSV fields to prevent CSV / Formula Injection attacks (CWE-1236).
 * Formulas starting with =, +, -, @, \t, \r are prepended with a single quote.
 */
export function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();

  // Escape formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes by doubling them
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}
