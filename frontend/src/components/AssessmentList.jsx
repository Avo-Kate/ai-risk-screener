import { LEVEL_CLASS } from "../constants.js";

export default function AssessmentList({ assessments, error, onOpen }) {
  if (error) {
    return (
      <div className="banner banner-error">
        <strong>Could not load assessments.</strong> {error}
      </div>
    );
  }

  if (!assessments || assessments.length === 0) {
    return (
      <div className="card empty">
        <h2>No assessments yet</h2>
        <p>Run your first assessment from the “New assessment” tab.</p>
      </div>
    );
  }

  return (
    <div className="list">
      <h2 className="list-title">Past assessments</h2>
      <ul className="list-rows">
        {assessments.map((a) => {
          const cls = LEVEL_CLASS[a.overall_risk_level] || "level-medium";
          const date = a.created_at
            ? new Date(a.created_at).toLocaleString()
            : "";
          return (
            <li key={a.id}>
              <button className="list-row" onClick={() => onOpen(a.id)}>
                <span className="list-row-main">
                  <span className="list-row-name">{a.project_name}</span>
                  <span className="list-row-summary">{a.summary}</span>
                </span>
                <span className="list-row-meta">
                  <span className={`badge ${cls}`}>{a.overall_risk_level}</span>
                  <span className="list-row-date">{date}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
