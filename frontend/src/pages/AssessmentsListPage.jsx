// "/assessments": the caller's past assessments, fetched on every visit.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAssessments } from "../api.js";
import AssessmentList from "../components/AssessmentList.jsx";
import LoadingState from "../components/LoadingState.jsx";

export default function AssessmentsListPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listAssessments()
      .then((rows) => {
        if (!cancelled) setAssessments(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (assessments === null && !error) {
    return (
      <LoadingState title="Loading…" message="Fetching your assessments." />
    );
  }

  return (
    <AssessmentList
      assessments={assessments || []}
      error={error}
      onOpen={(id) => navigate(`/assessments/${id}`)}
    />
  );
}
