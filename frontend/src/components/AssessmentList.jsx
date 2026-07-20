// The list of past assessments.
//
// Search, filtering, sorting and pagination arrive in Phase 3.2 — this
// deliberately stays a plain list until the backend gains the query params in
// 3.1.
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

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {assessments.length}{" "}
        {assessments.length === 1 ? "assessment" : "assessments"}
      </p>
      <ul className="space-y-2.5">
        {assessments.map((a) => (
          <AssessmentRow key={a.id} assessment={a} />
        ))}
      </ul>
    </div>
  );
}
