// "/assessments": the caller's past assessments, with search, filters and
// pagination.
//
// Filter state lives in the URL query string rather than component state. That
// makes a filtered view shareable and refresh-proof, and lets the back button
// step through filter changes — the same reasoning behind giving assessments
// their own URLs in Phase 1.
//
// The search box is debounced before it reaches the URL, so typing does not
// push a history entry per keystroke or fire a request per character.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listAssessments } from "../api.js";
import AssessmentFilters, {
  NoMatches,
  Pagination,
} from "../components/AssessmentFilters.jsx";
import AssessmentList from "../components/AssessmentList.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { ArchiveBoxIcon } from "../components/ui/icons.jsx";
import { DEFAULT_SORT, PAGE_SIZE } from "../constants.js";

const SEARCH_DEBOUNCE_MS = 300;

export default function AssessmentsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derived view of the URL — the single source of truth for the query.
  const query = useMemo(
    () => ({
      q: searchParams.get("q") || "",
      riskLevel: searchParams.getAll("risk"),
      industry: searchParams.getAll("industry"),
      sort: searchParams.get("sort") || DEFAULT_SORT,
      archived: searchParams.get("archived") === "1",
      offset: Number(searchParams.get("offset") || 0),
    }),
    [searchParams],
  );

  // The input is controlled locally so typing stays responsive; the URL catches
  // up after the debounce.
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [page, setPage] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Keep the box in step when the URL changes from elsewhere (back button,
  // "clear all", a shared link).
  useEffect(() => {
    setSearchDraft(query.q);
  }, [query.q]);

  useEffect(() => {
    if (searchDraft === query.q) return;
    const id = setTimeout(() => {
      updateParams({ q: searchDraft || null, offset: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // updateParams is stable enough for this effect's purpose; re-running on
    // searchParams identity would cancel the pending debounce on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, query.q]);

  const [sortField, sortOrder] = query.sort.split(":");

  // `query.riskLevel` / `query.industry` are fresh arrays on every memo run, so
  // depending on them directly would refetch on any re-render. Depend on their
  // serialised form instead.
  const riskKey = query.riskLevel.join(",");
  const industryKey = query.industry.join(",");

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);
    listAssessments({
      q: query.q,
      riskLevel: query.riskLevel,
      industry: query.industry,
      sort: sortField,
      order: sortOrder,
      archived: query.archived,
      limit: PAGE_SIZE,
      offset: query.offset,
    })
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
    // riskKey/industryKey stand in for the arrays above — see the note there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query.q,
    riskKey,
    industryKey,
    query.archived,
    query.offset,
    sortField,
    sortOrder,
    reloadKey,
  ]);

  /**
   * Patch the URL. `null` removes a key; arrays become repeated params.
   * Filter changes reset the offset — staying on page 4 of a set that just
   * shrank to one page shows an empty screen.
   */
  function updateParams(patch) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          next.delete(key);
          if (value == null || value === "") continue;
          if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true },
    );
  }

  const toggle = (key, current, value) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateParams({ [key]: next.length ? next : null, offset: null });
  };

  function clearAll() {
    setSearchDraft("");
    setSearchParams({}, { replace: true });
  }

  const activeCount =
    (query.q ? 1 : 0) + query.riskLevel.length + query.industry.length;
  const isFiltered = activeCount > 0;

  return (
    <div className="space-y-5">
      <AssessmentFilters
        search={searchDraft}
        onSearchChange={setSearchDraft}
        riskLevels={query.riskLevel}
        onToggleRisk={(v) => toggle("risk", query.riskLevel, v)}
        industries={query.industry}
        onToggleIndustry={(v) => toggle("industry", query.industry, v)}
        sort={query.sort}
        onSortChange={(v) => updateParams({ sort: v, offset: null })}
        showArchived={query.archived}
        onToggleArchived={() =>
          updateParams({ archived: query.archived ? null : "1", offset: null })
        }
        onClear={clearAll}
        activeCount={activeCount}
      />

      {error ? (
        <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : page === null ? (
        <LoadingState message="Fetching your assessments." />
      ) : page.total === 0 && query.archived && !isFiltered ? (
        <EmptyState
          icon={ArchiveBoxIcon}
          title="Nothing archived"
          message="Archiving an assessment hides it from your active list without deleting it."
        />
      ) : page.total === 0 && isFiltered ? (
        <NoMatches onClear={clearAll} />
      ) : (
        <>
          <AssessmentList assessments={page.items} />
          <Pagination
            total={page.total}
            limit={page.limit}
            offset={page.offset}
            onOffsetChange={(offset) =>
              updateParams({ offset: offset || null })
            }
          />
        </>
      )}
    </div>
  );
}
