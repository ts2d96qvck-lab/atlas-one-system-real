export function escapeCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function rowsToCsv(rows: string[][]) {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return `\uFEFF${body}`;
}
