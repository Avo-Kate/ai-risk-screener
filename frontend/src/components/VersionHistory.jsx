// Version switcher for an assessment family.
//
// Only rendered when there is more than one version — a "v1 of 1" control is
// noise. Each entry is a real link to that version's own URL, so any version
// can be bookmarked or shared.
import { Link } from "react-router-dom";
import { formatDateTime } from "../format.js";
import { RiskBadge } from "./ui/Badge.jsx";
import Card from "./ui/Card.jsx";
import { cx } from "./ui/cx.js";
import { HistoryIcon } from "./ui/icons.jsx";

export default function VersionHistory({ versions, currentId }) {
  if (!versions || versions.length < 2) return null;

  const latestVersion = Math.max(...versions.map((v) => v.version));

  return (
    <Card as="section">
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
        <HistoryIcon className="h-4 w-4 text-muted" />
        Version history
      </h3>
      <p className="mt-0.5 mb-3 text-sm text-muted">
        {versions.length} versions. Each re-run is kept, so an earlier verdict
        stays readable.
      </p>

      <ol className="space-y-2">
        {versions.map((v) => {
          const isCurrent = String(v.id) === String(currentId);
          return (
            <li key={v.id}>
              <Link
                to={`/assessments/${v.id}`}
                aria-current={isCurrent ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                  isCurrent
                    ? "border-accent-line bg-accent-soft"
                    : "border-line hover:border-line-strong hover:bg-sunken",
                )}
              >
                <span
                  className={cx(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    isCurrent ? "text-accent" : "text-ink-soft",
                  )}
                >
                  v{v.version}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {v.project_name}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatDateTime(v.created_at)}
                    {v.version === latestVersion && " · current"}
                  </span>
                </span>

                <RiskBadge level={v.overall_risk_level} />
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
