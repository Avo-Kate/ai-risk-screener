// "/assessments/:id": one full assessment, at a shareable URL.
//
// When arriving from a just-run assessment the full record is in router state
// and rendered immediately; on a direct visit / refresh it is fetched.
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getAssessment } from "../api.js";
import AssessmentResult from "../components/AssessmentResult.jsx";
import ErrorState from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Button from "../components/ui/Button.jsx";

export default function AssessmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();

  const passed = location.state?.record;
  const initial = passed && String(passed.id) === id ? passed : null;

  const [record, setRecord] = useState(initial);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (record && String(record.id) === id) return;
    let cancelled = false;
    setRecord(null);
    setError(null);
    getAssessment(id)
      .then((r) => {
        if (!cancelled) setRecord(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [id, record, reloadKey]);

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
    );
  }

  if (!record) {
    return <LoadingState message="Fetching the assessment." />;
  }

  return (
    <AssessmentResult
      record={record}
      actions={
        <Link to="/new">
          <Button variant="secondary">New assessment</Button>
        </Link>
      }
    />
  );
}
