// The list of past assessments.
//
// Only renders rows and the "nothing here yet" empty state. Search, filters,
// sorting and paging are the page's job (AssessmentsListPage) — note that the
// empty state below means "this account has no assessments at all", which is a
// different message from "your filters matched nothing" (see NoMatches).
import { Link } from "react-router-dom";
import AssessmentRow from "./AssessmentRow.jsx";
import EmptyState from "./EmptyState.jsx";
import Button from "./ui/Button.jsx";
import { ArchiveIcon } from "./ui/icons.jsx";

export default function AssessmentList({ assessments }) {
  if (!assessments || assessments.length === 0) {
    return (
      <EmptyState
        icon={ArchiveIcon}
        title="No assessments yet"
        message="Screened use cases are saved to your account and listed here."
        action={
          <Link to="/new">
            <Button>Run your first assessment</Button>
          </Link>
        }
      />
    );
  }

  // The count and paging controls are rendered by the page (Pagination), so
  // this stays a plain list.
  return (
    <ul className="space-y-2.5">
      {assessments.map((a) => (
        <AssessmentRow key={a.id} assessment={a} />
      ))}
    </ul>
  );
}
