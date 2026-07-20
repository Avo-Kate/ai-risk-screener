// "/new": form → (long) agent call → navigate to the saved record's own URL,
// passing the record along to avoid a refetch flash.
//
// A failed run keeps the form mounted, so the description the user wrote is
// still there and they can simply submit again.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAssessment } from "../api.js";
import AssessmentForm from "../components/AssessmentForm.jsx";
import AssessmentProgress from "../components/AssessmentProgress.jsx";
import { explainError } from "../components/ErrorState.jsx";
import Banner from "../components/ui/Banner.jsx";

export default function NewAssessmentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(input) {
    setLoading(true);
    setError(null);
    try {
      const record = await createAssessment(input);
      navigate(`/assessments/${record.id}`, { state: { record } });
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  }

  if (loading) return <AssessmentProgress />;

  const failure = error ? explainError(error) : null;

  return (
    <div className="space-y-5">
      {failure && (
        <Banner tone="error" title={failure.title}>
          {failure.body} Your answers below have been kept.
        </Banner>
      )}
      <AssessmentForm onSubmit={handleSubmit} />
    </div>
  );
}
