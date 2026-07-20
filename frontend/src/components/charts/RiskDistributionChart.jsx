// Counts of assessments per risk level.
//
// Built from plain HTML rather than SVG: horizontal bars are just boxes, and
// this way the level name and the count are real text in the DOM, which means
// the chart is readable by a screen reader without a separate table.
//
// Colour here is the reserved risk palette (see the contract note in theme.css),
// and it is *redundant* — every bar is labelled with its level and its count, so
// nothing depends on distinguishing the hues.
import { RISK_SOLID, RISK_FALLBACK } from "../../constants.js";
import { cx } from "../ui/cx.js";

export default function RiskDistributionChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-2.5">
      {data.map(({ level, count }) => {
        const solid = RISK_SOLID[level] || RISK_SOLID[RISK_FALLBACK];
        const pct = (count / max) * 100;

        return (
          <div key={level} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-ink-soft capitalize">
              {level}
            </span>

            {/* Track. The bar grows from a single baseline on the left, is
                capped in height, and rounds only its data-end. */}
            <span className="relative h-5 min-w-0 flex-1 rounded-sm bg-sunken">
              <span
                className={cx(
                  "absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-500",
                  solid,
                )}
                style={{ width: count === 0 ? 0 : `${Math.max(pct, 2)}%` }}
              />
            </span>

            <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
