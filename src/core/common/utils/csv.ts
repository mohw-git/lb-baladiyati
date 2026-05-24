/**
 * Tiny CSV serializer (no dependency). RFC 4180-ish:
 *  - fields containing comma, quote, CR or LF are wrapped in quotes
 *  - quotes inside fields are doubled
 *  - rows separated by CRLF
 *  - emits a UTF-8 BOM so Excel opens it correctly with non-ASCII content
 *
 * Important: we deliberately do NOT auto-coerce undefined/null to the string
 * "null"/"undefined"; they become empty cells.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T extends Record<string, unknown>>(
  headers: (keyof T & string)[],
  rows: T[],
): string {
  const BOM = '\uFEFF';
  const head = headers.map(escapeCell).join(',');
  const body = rows
    .map((row) => headers.map((h) => escapeCell(row[h])).join(','))
    .join('\r\n');
  return body ? `${BOM}${head}\r\n${body}\r\n` : `${BOM}${head}\r\n`;
}
