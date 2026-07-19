// The assessment workspace at "/": form → (long) agent call → navigate to the
// saved record's own URL, passing the record along to avoid a refetch flash.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAssessment } from "../api.js";
import AssessmentForm from "../components/AssessmentForm.jsx";
import LoadingState from "../components/LoadingState.jsx";

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
      setError(e.message);
      setLoading(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <>
      {error && (
        <div className="banner banner-error">
          <strong>Something went wrong.</strong> {error}
        </div>
      )}
      <AssessmentForm onSubmit={handleSubmit} />
    </>
  );
}
