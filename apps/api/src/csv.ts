import { applyDecorators, Header } from '@nestjs/common';

// Download headers for a CSV route: avantra-<name>.csv
export const CsvFile = (name: string) =>
  applyDecorators(Header('content-type', 'text/csv; charset=utf-8'), Header('content-disposition', `attachment; filename="avantra-${name}.csv"`));

// CSV for admin exports. UTF-8 BOM so Excel shows Indian names correctly.
// Cells starting with = + - @ get a leading ' so a name like "=HYPERLINK(...)" can't run as a formula in Excel.
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
