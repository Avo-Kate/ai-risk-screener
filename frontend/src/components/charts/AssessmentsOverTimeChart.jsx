// Assessments per month — one series, so no legend: the card's title names it.
//
// Deliberately hand-rolled SVG rather than a charting library. Two simple charts
// did not justify the dependency weight, and drawing the marks directly is what
// lets them follow the house specs exactly (2px line, ~10% area wash, hairline
// solid gridlines, an end dot with a surface-coloured ring).
//
// The same data is emitted as a visually-hidden table, so the series is
// available to a screen reader rather than locked inside the drawing.
import { useState } from "react";
import { useElementWidth } from "./useElementWidth.js";

const HEIGHT = 180;
const PAD = { top: 12, right: 16, bottom: 26, left: 30 };

/** "2026-07" → "Jul", and "Jul 26" for January or the first point. */
function monthLabel(key, { withYear = false } = {}) {
  const [year, month] = key.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    undefined,
    { month: "short", timeZone: "UTC" },
  );
  return withYear ? `${name} ${String(year).slice(2)}` : name;
}

/** Integer tick values from 0 to a rounded-up max — counts are never fractional. */
function ticksFor(max) {
  if (max <= 1) return [0, 1];
  if (max <= 4) return Array.from({ length: max + 1 }, (_, i) => i);
  const step = Math.ceil(max / 4);
  const top = step * 4;
  return [0, step, step * 2, step * 3, top];
}

export default function AssessmentsOverTimeChart({ data }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const maxCount = Math.max(0, ...data.map((d) => d.count));
  const ticks = ticksFor(maxCount);
  const yMax = ticks[ticks.length - 1];

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i) =>
    PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (count) => PAD.top + plotH - (count / yMax) * plotH;

  const linePath = data
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.count)}`)
    .join(" ");
  const areaPath =
    data.length > 0
      ? `${linePath} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`
      : "";

  // Label every nth month so ticks never collide on a narrow card.
  const labelStep = Math.max(
    1,
    Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))),
  );

  function handleMove(event) {
    if (!plotW) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rel = event.clientX - rect.left - PAD.left;
    const ratio = plotW ? rel / plotW : 0;
    const index = Math.round(ratio * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, index)));
  }

  const last = data.length - 1;
  const active = hover ?? last;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Assessments per month"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          className="block touch-none"
        >
          {/* Gridlines: hairline, solid, one step off the surface. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-muted text-[11px] tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Area wash, then the line on top. */}
          <path d={areaPath} fill="var(--color-accent)" opacity="0.1" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Month ticks. */}
          {data.map((d, i) =>
            i % labelStep === 0 || i === last ? (
              <text
                key={d.month}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
                className="fill-muted text-[11px]"
              >
                {monthLabel(d.month, { withYear: i === 0 })}
              </text>
            ) : null,
          )}

          {/* Hover crosshair. */}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
          )}

          {/* Active marker, ringed in the surface colour so it stays legible. */}
          <circle
            cx={x(active)}
            cy={y(data[active]?.count ?? 0)}
            r="4.5"
            fill="var(--color-accent)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        </svg>
      )}

      {/* Tooltip, or the endpoint value when idle. */}
      {width > 0 && data[active] && (
        <div
          className="pointer-events-none absolute rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-raised"
          style={{
            left: Math.min(
              Math.max(x(active) - 44, 0),
              Math.max(width - 92, 0),
            ),
            top: Math.max(y(data[active].count) - 48, 0),
          }}
        >
          <div className="font-semibold text-ink">
            {data[active].count}{" "}
            {data[active].count === 1 ? "assessment" : "assessments"}
          </div>
          <div className="text-muted">
            {monthLabel(data[active].month, { withYear: true })}
          </div>
        </div>
      )}

      {/* The series in text form, for screen readers. */}
      <table className="sr-only">
        <caption>Assessments per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Assessments</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{monthLabel(d.month, { withYear: true })}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
