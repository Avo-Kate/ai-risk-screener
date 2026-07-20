// "/assessments": the caller's past assessments, fetched on every visit.
import { useEffect, useState } from "react";
import { listAssessments } from "../api.js";
import AssessmentList from "../components/AssessmentList.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";

export default function AssessmentsListPage() {
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

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
    );
  }

  if (assessments === null) {
    return <LoadingState message="Fetching your assessments." />;
  }

  return <AssessmentList assessments={assessments} />;
}
