// Search, filter and sort controls for the past-assessments list.
//
// This component is deliberately stateless about *what* the filters are — the
// page owns that, because the filter state lives in the URL (see
// AssessmentsListPage). That keeps a filtered view shareable and survivable
// across a refresh, and means the back button steps through filter changes.
import { INDUSTRIES, RISK_LEVELS, SORT_OPTIONS } from "../constants.js";
import { RiskDot } from "./ui/Badge.jsx";
import Button, { LinkButton } from "./ui/Button.jsx";
import Card, { Eyebrow } from "./ui/Card.jsx";
import { Select, TextInput } from "./ui/Form.jsx";
import { cx } from "./ui/cx.js";
import { ArchiveBoxIcon, CloseIcon, SearchIcon } from "./ui/icons.jsx";

/** A toggleable filter chip. Selected state is conveyed by more than colour. */
function Chip({ selected, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={cx(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        selected
          ? "border-accent bg-accent font-semibold text-white"
          : "border-line-strong bg-surface text-ink-soft hover:border-accent-line hover:bg-accent-soft",
      )}
    >
      {children}
    </button>
  );
}

export default function AssessmentFilters({
  search,
  onSearchChange,
  riskLevels,
  onToggleRisk,
  industries,
  onToggleIndustry,
  sort,
  onSortChange,
  showArchived,
  onToggleArchived,
  onClear,
  activeCount,
}) {
  return (
    <Card as="section" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <TextInput
            type="search"
            aria-label="Search assessments"
            placeholder="Search by project name or summary…"
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="sort"
            className="text-sm whitespace-nowrap text-muted"
          >
            Sort
          </label>
          <Select
            id="sort"
            className="w-auto"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Eyebrow className="mb-2">Risk level</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {RISK_LEVELS.map((level) => (
              <Chip
                key={level}
                selected={riskLevels.includes(level)}
                onClick={() => onToggleRisk(level)}
              >
                <span className="flex items-center gap-1.5">
                  {!riskLevels.includes(level) && <RiskDot level={level} />}
                  <span className="capitalize">{level}</span>
                </span>
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow className="mb-2">Industry</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((ind) => (
              <Chip
                key={ind}
                selected={industries.includes(ind)}
                onClick={() => onToggleIndustry(ind)}
              >
                {ind}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
        <Chip
          selected={showArchived}
          onClick={onToggleArchived}
          title="Archived assessments are hidden from the active list and excluded from the dashboard"
        >
          <span className="flex items-center gap-1.5">
            <ArchiveBoxIcon className="h-3.5 w-3.5" />
            Archived
          </span>
        </Chip>

        {activeCount > 0 && (
          <>
            <span className="text-sm text-muted">
              {activeCount} {activeCount === 1 ? "filter" : "filters"} active
            </span>
            <LinkButton onClick={onClear}>Clear all</LinkButton>
          </>
        )}
      </div>
    </Card>
  );
}

/** Pagination footer: range summary plus previous/next. */
export function Pagination({ total, limit, offset, onOffsetChange }) {
  if (total === 0) return null;

  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = to < total;

  if (!hasPrev && !hasNext) {
    return (
      <p className="text-sm text-muted">
        {total} {total === 1 ? "assessment" : "assessments"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Shown when filters exclude everything — distinct from "you have none yet". */
export function NoMatches({ onClear }) {
  return (
    <Card className="flex flex-col items-center py-12 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sunken text-muted">
        <CloseIcon className="h-6 w-6" />
      </span>
      <h2 className="text-lg font-semibold text-ink">
        No matching assessments
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        Nothing matches the current search and filters. Try loosening them.
      </p>
      <Button variant="secondary" className="mt-5" onClick={onClear}>
        Clear filters
      </Button>
    </Card>
  );
}
