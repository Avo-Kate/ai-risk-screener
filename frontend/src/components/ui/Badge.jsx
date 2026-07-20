// Risk and applicability pills. Colour never comes from the call site — it is
// looked up from the maps in constants.js so every surface agrees.
import {
  APPLICABILITY_BADGE,
  RISK_BADGE,
  RISK_FALLBACK,
  RISK_SOLID,
  RISK_TEXT,
} from "../../constants.js";
import { cx } from "./cx.js";

const PILL =
  "inline-block rounded-full font-bold capitalize whitespace-nowrap tracking-wide";

const PILL_SIZES = {
  sm: "text-xs px-2.5 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

export function RiskBadge({ level, label, size = "sm", className }) {
  const tone = RISK_BADGE[level] || RISK_BADGE[RISK_FALLBACK];
  return (
    <span className={cx(PILL, PILL_SIZES[size], tone, className)}>
      {label || level}
    </span>
  );
}

export function ApplicabilityBadge({ applicability, className }) {
  const tone =
    APPLICABILITY_BADGE[applicability] ||
    APPLICABILITY_BADGE["partially applies"];
  return (
    <span className={cx(PILL, PILL_SIZES.sm, tone, className)}>
      {applicability}
    </span>
  );
}

/**
 * Labelled three-segment meter for severity / likelihood.
 * The filled count and the colour both derive from the level, so the shape
 * reads even in greyscale (and in print, for Phase 4).
 */
export function LevelMeter({ label, level }) {
  const filled = { low: 1, medium: 2, high: 3 }[level] ?? 0;
  const solid = RISK_SOLID[level] || RISK_SOLID[RISK_FALLBACK];
  const text = RISK_TEXT[level] || RISK_TEXT[RISK_FALLBACK];

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cx(
              "h-1.5 w-4 rounded-sm",
              n <= filled ? solid : "bg-line-strong",
            )}
          />
        ))}
      </span>
      <span className={cx("text-xs font-bold capitalize", text)}>{level}</span>
    </div>
  );
}
