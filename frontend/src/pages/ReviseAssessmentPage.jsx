// "/assessments/:id/revise": re-run an assessment with revised inputs.
//
// The form is pre-filled from the original's stored input, so a revision is an
// edit of what was assessed rather than a retype. The result is saved as a new
// version of the same family — the original is never modified.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAssessment, reviseAssessment } from "../api.js";
import AssessmentForm from "../components/AssessmentForm.jsx";
import AssessmentProgress from "../components/AssessmentProgress.jsx";
import ErrorState, { explainError } from "../components/ErrorState.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Banner from "../components/ui/Banner.jsx";
import Card from "../components/ui/Card.jsx";

export default function ReviseAssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [original, setOriginal] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAssessment(id)
      .then((r) => {
        if (!cancelled) setOriginal(r);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(input) {
    setRunning(true);
    setRunError(null);
    try {
      const record = await reviseAssessment(id, input);
      navigate(`/assessments/${record.id}`, { state: { record } });
    } catch (e) {
      setRunError(e);
      setRunning(false);
    }
  }

  if (loadError) return <ErrorState error={loadError} />;
  if (!original) return <LoadingState message="Loading the original inputs." />;
  if (running) return <AssessmentProgress />;

  const failure = runError ? explainError(runError) : null;

  return (
    <div className="space-y-5">
      <Card as="section">
        <h2 className="text-lg font-semibold text-ink">Revise and re-run</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          This will run a fresh screening and save it as{" "}
          <strong className="text-ink">version {original.version + 1}</strong>{" "}
          of{" "}
          <Link
            to={`/assessments/${original.id}`}
            className="font-semibold text-accent hover:text-accent-hover"
          >
            {original.project_name}
          </Link>
          . Version {original.version} is kept exactly as it is.
        </p>
      </Card>

      {failure && (
        <Banner tone="error" title={failure.title}>
          {failure.body} Your edits below have been kept.
        </Banner>
      )}

      <AssessmentForm
        initialValues={original.input}
        onSubmit={handleSubmit}
        submitLabel="Re-run assessment"
      />
    </div>
  );
}
