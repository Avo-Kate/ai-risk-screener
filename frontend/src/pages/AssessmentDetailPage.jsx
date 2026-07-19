// "/assessments/:id": one full assessment, at a shareable URL.
//
// When arriving from a just-run assessment the full record is in router state
// and rendered immediately; on a direct visit / refresh it is fetched.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getAssessment } from "../api.js";
import AssessmentResult from "../components/AssessmentResult.jsx";
import LoadingState from "../components/LoadingState.jsx";

export default function AssessmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const passed = location.state?.record;
  const initial = passed && String(passed.id) === id ? passed : null;

  const [record, setRecord] = useState(initial);
  const [error, setError] = useState(null);

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
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, record]);

  if (error) {
    return (
      <div className="banner banner-error">
        <strong>Could not load this assessment.</strong> {error}{" "}
        <Link to="/assessments">Back to past assessments</Link>
      </div>
    );
  }

  if (!record) {
    return <LoadingState title="Loading…" message="Fetching the assessment." />;
  }

  return <AssessmentResult record={record} onNew={() => navigate("/")} />;
}
