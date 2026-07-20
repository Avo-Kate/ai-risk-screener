// "/": the landing page for a signed-in user.
//
// Phase 2 establishes the slot with the primary action and a recent-activity
// list. Phase 3.3 fills the rest in — stat tiles, a risk-distribution chart and
// an assessments-over-time chart, fed by a new GET /api/stats endpoint.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAssessments } from "../api.js";
import AssessmentRow from "../components/AssessmentRow.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { ArrowRightIcon, NewAssessmentIcon } from "../components/ui/icons.jsx";

const RECENT_COUNT = 5;

function StartCard() {
  return (
    <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">
          Screen a new AI use case
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Describe the system and its context. The screening returns a risk
          classification against the EU AI Act, NIST AI RMF, GDPR and ISO/IEC
          42001, with obligations and recommended next steps.
        </p>
      </div>
      <Link to="/new" className="shrink-0">
        <Button size="lg">
          New assessment
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </Link>
    </Card>
  );
}

export default function DashboardPage() {
  const [assessments, setAssessments] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setAssessments(null);
    setError(null);
    listAssessments()
      .then((rows) => {
        if (!cancelled) setAssessments(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const recent = assessments?.slice(0, RECENT_COUNT) ?? [];
  const hasMore = (assessments?.length ?? 0) > RECENT_COUNT;

  return (
    <div className="space-y-6">
      <StartCard />

      {error ? (
        <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : assessments === null ? (
        <LoadingState message="Loading your assessments." />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={NewAssessmentIcon}
          title="No assessments yet"
          message="Once you screen a use case it is saved to your account and appears here."
          action={
            <Link to="/new">
              <Button>Run your first assessment</Button>
            </Link>
          }
        />
      ) : (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">
              Recent assessments
            </h2>
            {hasMore && (
              <Link
                to="/assessments"
                className="text-sm font-semibold text-accent hover:text-accent-hover"
              >
                View all {assessments.length}
              </Link>
            )}
          </div>
          <ul className="space-y-2.5">
            {recent.map((a) => (
              <AssessmentRow key={a.id} assessment={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
