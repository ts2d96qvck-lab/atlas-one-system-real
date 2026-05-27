export function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export function applyMessageTemplate(
  message: string,
  context: Record<string, string | number | null | undefined>
) {
  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

export function parseRecipientLines(raw: string) {
  const rows: Array<{ phone: string; name?: string }> = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [phonePart, namePart] = trimmed.split(/[,;\t]/).map((part) => part.trim());
    const phone = normalizeWhatsAppNumber(phonePart ?? "");
    if (!phone) continue;
    rows.push({ phone, name: namePart || undefined });
  }
  return rows;
}
