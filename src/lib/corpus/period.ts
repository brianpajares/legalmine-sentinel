import type { BBox } from "@/types/corpus";

/** Calendar period identifiers, `YYYY-MM`, always in UTC so a deployment's
 *  timezone can never shift which month a snapshot belongs to. */

export function periodOf(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) throw new Error(`Not a period: ${period}`);
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function isPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Human label for a report header, e.g. "August 2026". */
export function periodLabel(period: string, locale = "en-US"): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

export function bboxUnion(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  return boxes.reduce<BBox>(
    (acc, box) => [
      Math.min(acc[0], box[0]),
      Math.min(acc[1], box[1]),
      Math.max(acc[2], box[2]),
      Math.max(acc[3], box[3]),
    ],
    [...boxes[0]] as BBox,
  );
}
