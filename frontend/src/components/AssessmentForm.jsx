import { useState } from "react";
import {
  DATA_TYPES,
  DEPLOYMENT_CONTEXTS,
  GEOGRAPHIC_SCOPES,
  INDUSTRIES,
} from "../constants.js";

const INITIAL = {
  project_name: "",
  use_case_description: "",
  industry: "other",
  deployment_context: "internal tool",
  data_types: [],
  affects_decisions: false,
  geographic_scope: [],
};

export default function AssessmentForm({ onSubmit }) {
  const [form, setForm] = useState(INITIAL);
  const [touched, setTouched] = useState(false);

  const descriptionTooShort = form.use_case_description.trim().length < 10;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Multi-select checkboxes for data types. Selecting "none" clears the others,
  // and selecting any specific type clears "none" — they are mutually exclusive.
  function toggleDataType(value) {
    setForm((f) => {
      let next;
      if (value === "none") {
        next = f.data_types.includes("none") ? [] : ["none"];
      } else {
        const withoutNone = f.data_types.filter((d) => d !== "none");
        next = withoutNone.includes(value)
          ? withoutNone.filter((d) => d !== value)
          : [...withoutNone, value];
      }
      return { ...f, data_types: next };
    });
  }

  function toggleScope(value) {
    setForm((f) => ({
      ...f,
      geographic_scope: f.geographic_scope.includes(value)
        ? f.geographic_scope.filter((s) => s !== value)
        : [...f.geographic_scope, value],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (descriptionTooShort) return;
    onSubmit({
      ...form,
      project_name: form.project_name.trim() || "Untitled project",
    });
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>Describe the AI use case</h2>
      <p className="form-intro">
        The more specific you are, the more grounded the assessment. Required
        fields are marked with <span className="req">*</span>.
      </p>

      <div className="field">
        <label htmlFor="project_name">Project name</label>
        <input
          id="project_name"
          type="text"
          placeholder="e.g. Candidate Screening Assistant"
          value={form.project_name}
          onChange={(e) => update("project_name", e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="use_case_description">
          Use case description <span className="req">*</span>
        </label>
        <textarea
          id="use_case_description"
          rows={6}
          placeholder="What does the system do? Who uses it, on whom, and to make what decisions?"
          value={form.use_case_description}
          onChange={(e) => update("use_case_description", e.target.value)}
          aria-invalid={touched && descriptionTooShort}
        />
        {touched && descriptionTooShort && (
          <p className="field-error">
            Please describe the use case (at least 10 characters).
          </p>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="industry">Industry / domain</label>
          <select
            id="industry"
            value={form.industry}
            onChange={(e) => update("industry", e.target.value)}
          >
            {INDUSTRIES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="deployment_context">Deployment context</label>
          <select
            id="deployment_context"
            value={form.deployment_context}
            onChange={(e) => update("deployment_context", e.target.value)}
          >
            {DEPLOYMENT_CONTEXTS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <span className="group-label">Data types used</span>
        <div className="checkbox-grid">
          {DATA_TYPES.map((opt) => (
            <label key={opt} className="checkbox">
              <input
                type="checkbox"
                checked={form.data_types.includes(opt)}
                onChange={() => toggleDataType(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <span className="group-label">Affects decisions about people</span>
          <div className="radio-row">
            <label className="radio">
              <input
                type="radio"
                name="affects_decisions"
                checked={form.affects_decisions === true}
                onChange={() => update("affects_decisions", true)}
              />
              <span>Yes</span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name="affects_decisions"
                checked={form.affects_decisions === false}
                onChange={() => update("affects_decisions", false)}
              />
              <span>No</span>
            </label>
          </div>
        </div>

        <div className="field">
          <span className="group-label">Geographic scope</span>
          <div className="checkbox-grid compact">
            {GEOGRAPHIC_SCOPES.map((opt) => (
              <label key={opt} className="checkbox">
                <input
                  type="checkbox"
                  checked={form.geographic_scope.includes(opt)}
                  onChange={() => toggleScope(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Run assessment
        </button>
      </div>
    </form>
  );
}
