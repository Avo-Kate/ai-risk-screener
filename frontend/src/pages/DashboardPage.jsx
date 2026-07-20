// "/": the landing page for a signed-in user.
//
// Two requests: /api/stats for the aggregates, and a short page of assessments
// for the recent-activity list. They are fetched together so the page settles
// in one pass rather than popping in twice.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStats, listAssessments } from "../api.js";
import AssessmentRow from "../components/AssessmentRow.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import AssessmentsOverTimeChart from "../components/charts/AssessmentsOverTimeChart.jsx";
import RiskDistributionChart from "../components/charts/RiskDistributionChart.jsx";
import { RiskBadge } from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { ArrowRightIcon, NewAssessmentIcon } from "../components/ui/icons.jsx";
import { RISK_LEVELS } from "../constants.js";

const RECENT_COUNT = 5;
const MONTHS = 12;

/** Label + value. No plot, so no hover layer — the number is the whole story. */
function StatTile({ label, value, detail }) {
  return (
    <Card className="min-w-0">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 truncate text-3xl font-semibold text-ink tabular-nums">
        {value}
      </p>
      {detail && <div className="mt-1.5 text-sm text-muted">{detail}</div>}
    </Card>
  );
}

/** The most severe level actually present, or null when there are none. */
function highestRisk(byRiskLevel) {
  const present = RISK_LEVELS.filter((level) =>
    byRiskLevel.some((r) => r.level === level && r.count > 0),
  );
  return present.length ? present[present.length - 1] : null;
}

export default function DashboardPage() {
  const [data, setData] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    Promise.all([
      getStats({ months: MONTHS }),
      listAssessments({ limit: RECENT_COUNT }),
    ])
      .then(([stats, page]) => {
        if (!cancelled) setData({ stats, recent: page.items });
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
    );
  }
  if (data === null) {
    return <LoadingState message="Loading your dashboard." />;
  }

  const { stats, recent } = data;

  // A brand-new account gets the invitation, not a wall of zeroes and flat charts.
  if (stats.total === 0) {
    return (
      <EmptyState
        icon={NewAssessmentIcon}
        title="Welcome — no assessments yet"
        message="Screen your first AI use case against the EU AI Act, NIST AI RMF, GDPR and ISO/IEC 42001. It takes about a minute to describe and under a minute to run."
        action={
          <Link to="/new">
            <Button size="lg">
              Run your first assessment
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </Link>
        }
      />
    );
  }

  const thisMonth = stats.over_time[stats.over_time.length - 1]?.count ?? 0;
  const topLevel = highestRisk(stats.by_risk_level);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total assessments" value={stats.total} />
        <StatTile label="Run this month" value={thisMonth} />
        <StatTile
          label="Highest risk recorded"
          value={topLevel ? <RiskBadge level={topLevel} size="lg" /> : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section">
          <h2 className="text-base font-semibold text-ink">
            Assessments by risk level
          </h2>
          <p className="mt-0.5 mb-4 text-sm text-muted">
            Across all {stats.total} assessments.
          </p>
          <RiskDistributionChart data={stats.by_risk_level} />
        </Card>

        <Card as="section">
          <h2 className="text-base font-semibold text-ink">
            Assessments over time
          </h2>
          <p className="mt-0.5 mb-2 text-sm text-muted">
            Last {MONTHS} months.
          </p>
          <AssessmentsOverTimeChart data={stats.over_time} />
        </Card>
      </div>

      {stats.by_industry.length > 1 && (
        <Card as="section">
          <h2 className="mb-3 text-base font-semibold text-ink">By industry</h2>
          <ul className="flex flex-wrap gap-2">
            {stats.by_industry.map(({ industry, count }) => (
              <li key={industry}>
                <Link
                  to={`/assessments?industry=${encodeURIComponent(industry)}`}
                  className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-ink-soft transition-colors hover:border-accent-line hover:bg-accent-soft"
                >
                  <span>{industry}</span>
                  <span className="font-semibold tabular-nums text-ink">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">Recent assessments</h2>
          <Link
            to="/assessments"
            className="text-sm font-semibold text-accent hover:text-accent-hover"
          >
            View all
          </Link>
        </div>
        <ul className="space-y-2.5">
          {recent.map((a) => (
            <AssessmentRow key={a.id} assessment={a} />
          ))}
        </ul>
      </section>
    </div>
  );
}
