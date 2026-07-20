// One row in a list of assessments — shared by the dashboard and the past
// assessments page so the two can never drift.
//
// It is a real <Link>, not a button with a click handler: assessment URLs are
// shareable, so they should be openable in a new tab like any other link.
import { Link } from "react-router-dom";
import { RiskBadge } from "./ui/Badge.jsx";
import { formatDateTime } from "../format.js";

export default function AssessmentRow({ assessment }) {
  return (
    <li>
      <Link
        to={`/assessments/${assessment.id}`}
        className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent-line hover:bg-accent-soft/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate font-semibold text-ink">
              {assessment.project_name}
            </span>
            {/* Only worth showing once an assessment has actually been re-run. */}
            {assessment.version_count > 1 && (
              <span
                className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-muted"
                title={`Version ${assessment.version} of ${assessment.version_count}`}
              >
                v{assessment.version}
              </span>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
            {assessment.summary}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <RiskBadge level={assessment.overall_risk_level} />
          <span className="text-xs whitespace-nowrap text-muted">
            {formatDateTime(assessment.created_at)}
          </span>
        </span>
      </Link>
    </li>
  );
}
