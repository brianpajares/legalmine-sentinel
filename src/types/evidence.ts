import type { SourceStatus, SourceTier } from "./sources";
import type { GeoGeometry } from "./geo";

/**
 * A single traceable fact (Plan Maestro §5.3, §6.2).
 *
 * Every sensitive statement the product makes must point at one of these.
 * A risk factor without evidence IDs is a bug, not a styling choice.
 */
export type EvidenceKind =
  /** Records whether a source answered at all, and with what caveats. */
  | "source_status"
  /** A concrete record returned by a source: a right, a protected area, a scene. */
  | "finding";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  sourceKey: string;
  sourceName: string;
  official: boolean;
  tier: SourceTier;
  status: SourceStatus;
  /** Short human title, e.g. "Protected area intersection — Reserva Nacional Tambopata". */
  title: string;
  /** Free-form detail rendered in the evidence drawer. */
  detail?: string;
  /** When the underlying observation happened (e.g. satellite acquisition date). */
  observedAt?: string;
  /** When we asked the source. */
  fetchedAt: string;
  /** The source's own validity date, when published. */
  validAt?: string;
  /** Link an auditor can open. */
  ref?: string;
  /** Geometry that supports the finding (intersection polygon, matched parcel...). */
  geometry?: GeoGeometry | null;
  /** Raw normalized attributes kept for the appendix. */
  metadata: Record<string, unknown>;
}
