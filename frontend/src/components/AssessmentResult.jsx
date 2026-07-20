// The rendered verdict.
//
// Reading order is deliberate and is the same order a reviewer needs it in:
// verdict → why → what applies → what could go wrong → what to do → caveat.
// Someone should be able to open this cold and know the answer from the first
// screenful.
//
// Phase 4 builds the print stylesheet and the PDF from this layout, so keep it
// linear and page-break friendly: no side-by-side columns carrying meaning, and
// nothing important hidden behind interaction that print cannot reveal
// (frameworks that apply are expanded by default for exactly this reason).
import { useState } from "react";
import { RISK_BADGE, RISK_FALLBACK } from "../constants.js";
import { formatDateTime } from "../format.js";
import { ApplicabilityBadge, LevelMeter } from "./ui/Badge.jsx";
import Card, { Eyebrow } from "./ui/Card.jsx";
import { cx } from "./ui/cx.js";
import { ChevronIcon } from "./ui/icons.jsx";

/** The headline: risk level and the one-paragraph summary, in risk colour. */
function Verdict({ level, summary }) {
  const tone = RISK_BADGE[level] || RISK_BADGE[RISK_FALLBACK];
  return (
    <section className={cx("rounded-xl border border-current/15 p-6", tone)}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
        Overall risk level
      </p>
      <p className="mt-1 text-3xl font-bold capitalize sm:text-4xl">{level}</p>
      <p className="mt-3 max-w-prose text-[0.95rem] leading-relaxed opacity-90">
        {summary}
      </p>
    </section>
  );
}

/** One-line orientation strip, so the shape of the result is clear at a glance. */
function AtAGlance({ result }) {
  const applying = result.frameworks.filter(
    (f) => f.applicability !== "does not apply",
  ).length;

  const items = [
    `${applying} of ${result.frameworks.length} frameworks apply`,
    `${result.risks.length} ${result.risks.length === 1 ? "risk" : "risks"} identified`,
    `${result.recommended_next_steps.length} recommended next ${
      result.recommended_next_steps.length === 1 ? "step" : "steps"
    }`,
  ];

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

/** Collapsible framework card built on native <details> for keyboard support. */
function FrameworkCard({ framework, open, onToggle }) {
  return (
    <Card as="article" padded={false}>
      <details
        open={open}
        onToggle={(e) => onToggle(e.currentTarget.open)}
        className="group"
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <h4 className="font-semibold text-ink">{framework.name}</h4>
            <p className="mt-1 text-sm font-medium text-ink-soft">
              {framework.classification}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ApplicabilityBadge applicability={framework.applicability} />
            <ChevronIcon
              className={cx(
                "h-4 w-4 text-muted transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        </summary>

        <div className="space-y-4 border-t border-line px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
            {framework.rationale}
          </p>

          {framework.key_obligations?.length > 0 && (
            <div>
              <Eyebrow className="mb-1.5">Key obligations</Eyebrow>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft marker:text-line-strong">
                {framework.key_obligations.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

function RiskCard({ risk }) {
  return (
    <Card as="article">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="font-semibold text-ink capitalize">{risk.category}</h4>
        <div className="flex shrink-0 gap-5">
          <LevelMeter label="Severity" level={risk.severity} />
          <LevelMeter label="Likelihood" level={risk.likelihood} />
        </div>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
        {risk.description}
      </p>

      {risk.mitigations?.length > 0 && (
        <div className="mt-4">
          <Eyebrow className="mb-1.5">Mitigations</Eyebrow>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft marker:text-line-strong">
            {risk.mitigations.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Recap({ input }) {
  const facts = [
    ["Industry", input.industry],
    ["Deployment", input.deployment_context],
    ["Affects decisions about people", input.affects_decisions ? "Yes" : "No"],
    ["Data types", input.data_types.join(", ") || "—"],
    ["Geographic scope", input.geographic_scope.join(", ") || "—"],
  ];

  return (
    <Card as="section">
      <h3 className="font-semibold text-ink">Use case as assessed</h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed whitespace-pre-line text-ink-soft">
        {input.use_case_description}
      </p>
      <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>
              <Eyebrow>{label}</Eyebrow>
            </dt>
            <dd className="mt-0.5 text-sm text-ink capitalize">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SectionTitle({ children, aside }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h3 className="text-lg font-semibold text-ink">{children}</h3>
      {aside}
    </div>
  );
}

export default function AssessmentResult({ record, actions }) {
  const { result, input, project_name, created_at } = record;

  // Frameworks that bear on the system start expanded; ones that do not apply
  // start collapsed so they do not dilute the page.
  const [openMap, setOpenMap] = useState(() =>
    result.frameworks.map((f) => f.applicability !== "does not apply"),
  );

  const allOpen = openMap.every(Boolean);
  const setAll = (value) => setOpenMap(openMap.map(() => value));

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-ink">{project_name}</h2>
          {created_at && (
            <p className="mt-1 text-sm text-muted">
              Assessed {formatDateTime(created_at)}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>

      <Verdict level={result.overall_risk_level} summary={result.summary} />
      <AtAGlance result={result} />

      <section>
        <SectionTitle
          aside={
            <button
              type="button"
              onClick={() => setAll(!allOpen)}
              className="text-sm font-semibold text-accent hover:text-accent-hover"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          }
        >
          Regulatory frameworks
        </SectionTitle>
        <div className="space-y-3">
          {result.frameworks.map((fw, i) => (
            <FrameworkCard
              key={i}
              framework={fw}
              open={openMap[i]}
              onToggle={(next) =>
                setOpenMap((m) => m.map((v, j) => (j === i ? next : v)))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Risks &amp; mitigations</SectionTitle>
        <div className="space-y-3">
          {result.risks.map((risk, i) => (
            <RiskCard key={i} risk={risk} />
          ))}
        </div>
      </section>

      <Card as="section">
        <h3 className="font-semibold text-ink">Recommended next steps</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft marker:font-semibold marker:text-accent">
          {result.recommended_next_steps.map((step, i) => (
            <li key={i} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </Card>

      <Recap input={input} />

      {result.disclaimer && (
        <p className="border-l-[3px] border-line-strong pl-4 text-sm text-muted italic">
          {result.disclaimer}
        </p>
      )}
    </article>
  );
}
