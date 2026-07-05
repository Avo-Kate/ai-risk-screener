import { useCallback, useEffect, useState } from "react";
import AssessmentForm from "./components/AssessmentForm.jsx";
import AssessmentResult from "./components/AssessmentResult.jsx";
import AssessmentList from "./components/AssessmentList.jsx";
import LoadingState from "./components/LoadingState.jsx";
import {
  createAssessment,
  getAssessment,
  getHealth,
  listAssessments,
} from "./api.js";

export default function App() {
  const [tab, setTab] = useState("new"); // "new" | "past"
  const [record, setRecord] = useState(null); // full record shown in result view
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [assessments, setAssessments] = useState([]);
  const [listError, setListError] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const refreshList = useCallback(async () => {
    try {
      setListError(null);
      setAssessments(await listAssessments());
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  // On mount: warn early if the API key isn't configured, and load the list.
  useEffect(() => {
    getHealth()
      .then((h) => setApiKeyMissing(!h.api_key_configured))
      .catch(() => {});
    refreshList();
  }, [refreshList]);

  async function handleSubmit(input) {
    setLoading(true);
    setError(null);
    setRecord(null);
    try {
      const result = await createAssessment(input);
      setRecord(result);
      refreshList();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(id) {
    setLoading(true);
    setError(null);
    try {
      const full = await getAssessment(id);
      setRecord(full);
      setTab("new"); // result view lives under the assessment workspace
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setRecord(null);
    setError(null);
    setTab("new");
  }

  function switchTab(next) {
    setError(null);
    if (next === "past") refreshList();
    setTab(next);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1>AI Governance Risk Assessment</h1>
            <p className="tagline">
              Screen an AI use case against the EU AI Act, NIST AI RMF, GDPR, and
              ISO/IEC 42001.
            </p>
          </div>
          <nav className="tabs">
            <button
              className={tab === "new" ? "tab active" : "tab"}
              onClick={() => switchTab("new")}
            >
              New assessment
            </button>
            <button
              className={tab === "past" ? "tab active" : "tab"}
              onClick={() => switchTab("past")}
            >
              Past assessments
            </button>
          </nav>
        </div>
      </header>

      <main className="container">
        {apiKeyMissing && (
          <div className="banner banner-warning">
            <strong>API key not configured.</strong> Set{" "}
            <code>ANTHROPIC_API_KEY</code> in <code>backend/.env</code> and restart
            the backend to run new assessments. You can still browse the seeded
            example below.
          </div>
        )}

        {error && (
          <div className="banner banner-error">
            <strong>Something went wrong.</strong> {error}
          </div>
        )}

        {loading && <LoadingState />}

        {!loading && tab === "new" && !record && (
          <AssessmentForm onSubmit={handleSubmit} />
        )}

        {!loading && tab === "new" && record && (
          <AssessmentResult record={record} onNew={startNew} />
        )}

        {!loading && tab === "past" && (
          <AssessmentList
            assessments={assessments}
            error={listError}
            onOpen={handleOpen}
          />
        )}
      </main>

      <footer className="app-footer">
        Decision-support tool — not legal advice. Validate findings with qualified
        legal and compliance professionals.
      </footer>
    </div>
  );
}
