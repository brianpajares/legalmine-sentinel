/**
 * Attribute readers for government layers.
 *
 * Field names differ between services and change between layer versions, so we
 * look up the configured name first and then a short list of documented
 * alternates, case-insensitively. When nothing matches we return null — the UI
 * shows "not reported by the source" rather than a placeholder.
 */

export function pickField(
  attributes: Record<string, unknown>,
  candidates: (string | undefined)[],
): unknown {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(attributes)) {
    lookup.set(key.toLowerCase(), value);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const value = lookup.get(candidate.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export function pickString(
  attributes: Record<string, unknown>,
  candidates: (string | undefined)[],
): string | null {
  const value = pickField(attributes, candidates);
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function pickNumber(
  attributes: Record<string, unknown>,
  candidates: (string | undefined)[],
): number | null {
  const value = pickField(attributes, candidates);
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Esri date fields are epoch milliseconds. Anything else is passed through as
 * text so the dossier can quote the source verbatim.
 */
export function pickDate(
  attributes: Record<string, unknown>,
  candidates: (string | undefined)[],
): string | null {
  const value = pickField(attributes, candidates);
  if (value === null) return null;
  if (typeof value === "number" && value > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}
