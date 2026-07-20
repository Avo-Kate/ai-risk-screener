// The wait state for a running assessment.
//
// The call is a single non-streaming request that takes 10–60 seconds, so there
// is no real progress to report. Rather than fake a percentage, this shows an
// honest elapsed counter, names the stage the run is *expected* to be in, and
// says plainly that leaving the page cancels it.
//
// The stage timings below are presentation only — they are not driven by the
// backend, which is why the copy says "usually" rather than asserting state.
import { useEffect, useState } from "react";
import Card from "./ui/Card.jsx";
import { Spinner } from "./LoadingState.jsx";
import { cx } from "./ui/cx.js";

const STAGES = [
  { at: 0, label: "Sending the use case to the governance agent" },
  { at: 6, label: "Screening against the EU AI Act and NIST AI RMF" },
  { at: 18, label: "Screening against GDPR and ISO/IEC 42001" },
  { at: 32, label: "Drafting risks, obligations and next steps" },
];

export default function AssessmentProgress() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Warn the user if they try to close the tab mid-run.
  useEffect(() => {
    function warn(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const currentIndex = STAGES.reduce(
    (acc, stage, i) => (elapsed >= stage.at ? i : acc),
    0,
  );
  const overdue = elapsed > 75;

  return (
    <Card className="py-10">
      <div className="flex flex-col items-center text-center">
        <Spinner />
        <h2 className="mt-4 text-lg font-semibold text-ink">
          Assessing the use case…
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted">
          A full screening usually takes 10–60 seconds. Please keep this page
          open — navigating away cancels the run.
        </p>
        <p className="mt-3 font-mono text-sm tabular-nums text-ink-soft">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}{" "}
          elapsed
        </p>
      </div>

      <ol className="mx-auto mt-8 max-w-sm space-y-3">
        {STAGES.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={stage.at}
              className={cx(
                "flex items-start gap-3 text-sm transition-colors",
                active ? "text-ink" : done ? "text-muted" : "text-muted/60",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none",
                  done && "border-risk-low-solid bg-risk-low-solid text-white",
                  active && "border-accent text-accent",
                  !done && !active && "border-line-strong",
                )}
              >
                {done ? "✓" : ""}
              </span>
              <span className={cx(active && "font-medium")}>{stage.label}</span>
            </li>
          );
        })}
      </ol>

      {overdue && (
        <p className="mx-auto mt-8 max-w-md text-center text-sm text-muted">
          This one is taking longer than usual. Long or complex descriptions
          take more time to screen — it is still running.
        </p>
      )}
    </Card>
  );
}
