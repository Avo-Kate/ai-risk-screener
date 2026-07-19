import { APPLICABILITY_CLASS, LEVEL_CLASS } from "../constants.js";

function LevelBadge({ level, label }) {
  const cls = LEVEL_CLASS[level] || "level-medium";
  return <span className={`badge ${cls}`}>{label || level}</span>;
}

function MiniLevel({ label, level }) {
  // Small labelled severity/likelihood indicator with a 3-segment meter.
  const filled = { low: 1, medium: 2, high: 3 }[level] || 0;
  const cls = LEVEL_CLASS[level] || "level-medium";
  return (
    <div className="mini-level">
      <span className="mini-level-label">{label}</span>
      <span className="meter" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= filled ? `seg ${cls}-bg` : "seg"} />
        ))}
      </span>
      <span className={`mini-level-value ${cls}-text`}>{level}</span>
    </div>
  );
}

export default function AssessmentResult({ record, onNew }) {
  const { result, input, project_name, created_at } = record;
  const date = created_at ? new Date(created_at).toLocaleString() : null;

  return (
    <div className="result">
      <div className="result-top">
        <div>
          <h2>{project_name}</h2>
          {date && <p className="muted">Assessed {date}</p>}
        </div>
        {onNew && (
          <button className="btn btn-secondary" onClick={onNew}>
            New assessment
          </button>
        )}
      </div>

      {/* Overall risk + summary */}
      <section className="card overall">
        <div className="overall-head">
          <span className="overall-label">Overall risk level</span>
          <LevelBadge level={result.overall_risk_level} />
        </div>
        <p className="summary">{result.summary}</p>
      </section>

      {/* Input recap */}
      <section className="card recap">
        <h3>Use case</h3>
        <p className="recap-desc">{input.use_case_description}</p>
        <dl className="recap-grid">
          <div>
            <dt>Industry</dt>
            <dd>{input.industry}</dd>
          </div>
          <div>
            <dt>Deployment</dt>
            <dd>{input.deployment_context}</dd>
          </div>
          <div>
            <dt>Affects people's decisions</dt>
            <dd>{input.affects_decisions ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Data types</dt>
            <dd>
              {input.data_types.length ? input.data_types.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt>Geographic scope</dt>
            <dd>
              {input.geographic_scope.length
                ? input.geographic_scope.join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Frameworks */}
      <section className="section">
        <h3 className="section-title">Regulatory frameworks</h3>
        <div className="framework-list">
          {result.frameworks.map((fw, i) => (
            <article className="card framework" key={i}>
              <div className="framework-head">
                <h4>{fw.name}</h4>
                <span
                  className={`badge ${
                    APPLICABILITY_CLASS[fw.applicability] || "apply-partial"
                  }`}
                >
                  {fw.applicability}
                </span>
              </div>
              <p className="classification">{fw.classification}</p>
              <p className="rationale">{fw.rationale}</p>
              {fw.key_obligations?.length > 0 && (
                <>
                  <span className="obligations-label">Key obligations</span>
                  <ul className="bullets">
                    {fw.key_obligations.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Risks */}
      <section className="section">
        <h3 className="section-title">Risks &amp; mitigations</h3>
        <div className="risk-list">
          {result.risks.map((risk, i) => (
            <article className="card risk" key={i}>
              <div className="risk-head">
                <h4 className="risk-category">{risk.category}</h4>
                <div className="risk-levels">
                  <MiniLevel label="Severity" level={risk.severity} />
                  <MiniLevel label="Likelihood" level={risk.likelihood} />
                </div>
              </div>
              <p className="risk-desc">{risk.description}</p>
              {risk.mitigations?.length > 0 && (
                <>
                  <span className="obligations-label">Mitigations</span>
                  <ul className="bullets">
                    {risk.mitigations.map((m, j) => (
                      <li key={j}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Next steps */}
      <section className="card next-steps">
        <h3>Recommended next steps</h3>
        <ol className="numbered">
          {result.recommended_next_steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {/* Disclaimer */}
      {result.disclaimer && <p className="disclaimer">{result.disclaimer}</p>}
    </div>
  );
}
