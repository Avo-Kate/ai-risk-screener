// The use-case intake form.
//
// Three sections mirroring how an assessor actually thinks about a system:
// what it is → what data it touches and whom it affects → where it operates.
//
// Validation runs on every render (see `validate`) but errors are only shown
// once a field has been blurred or a submit has been attempted, so the form
// never scolds someone who is still filling it in. Submitting with errors is
// blocked and focuses the first problem.
//
// The constraints here mirror backend/app/schemas.py::AssessmentInput. Keeping
// them in step means a valid-looking form can never come back as a 422.
import { useRef, useState } from "react";
import {
  DATA_TYPES,
  DEPLOYMENT_CONTEXTS,
  GEOGRAPHIC_SCOPES,
  INDUSTRIES,
} from "../constants.js";
import Banner from "./ui/Banner.jsx";
import Button from "./ui/Button.jsx";
import Card from "./ui/Card.jsx";
import {
  Field,
  OptionGrid,
  OptionTile,
  Select,
  TextInput,
  Textarea,
} from "./ui/Form.jsx";

const NAME_MAX = 255;
const DESC_MIN = 10;
const DESC_MAX = 8000;
// Not a rule — the point below which the screening has little to work with.
const DESC_RECOMMENDED = 150;

const INITIAL = {
  project_name: "",
  use_case_description: "",
  industry: "other",
  deployment_context: "internal tool",
  data_types: [],
  affects_decisions: false,
  geographic_scope: [],
};

/** Returns { field: message } for everything currently wrong. */
function validate(form) {
  const errors = {};
  const desc = form.use_case_description.trim();

  if (form.project_name.length > NAME_MAX) {
    errors.project_name = `Keep the name under ${NAME_MAX} characters.`;
  }
  if (desc.length === 0) {
    errors.use_case_description = "Describe what the system does.";
  } else if (desc.length < DESC_MIN) {
    errors.use_case_description = `Add a little more — at least ${DESC_MIN} characters.`;
  } else if (form.use_case_description.length > DESC_MAX) {
    errors.use_case_description = `That is over the ${DESC_MAX.toLocaleString()} character limit.`;
  }
  if (form.data_types.length === 0) {
    errors.data_types =
      "Select the data the system uses, or choose “none” if it uses no personal data.";
  }
  if (form.geographic_scope.length === 0) {
    errors.geographic_scope =
      "Select at least one region — this decides which regimes apply.";
  }
  return errors;
}

function Section({ step, title, description, children }) {
  return (
    <Card as="section" className="space-y-5">
      <div className="flex gap-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 max-w-prose text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-5 sm:pl-[2.625rem]">{children}</div>
    </Card>
  );
}

/** Live character guidance under the description field. */
function DescriptionCounter({ value }) {
  const length = value.trim().length;
  let tone = "text-muted";
  let advice = `Aim for ${DESC_RECOMMENDED}+ characters — the more specific the description, the more grounded the assessment.`;

  if (length >= DESC_RECOMMENDED) {
    tone = "text-risk-low-fg";
    advice = "Good level of detail.";
  } else if (length >= DESC_MIN) {
    tone = "text-risk-medium-fg";
    advice = "This will work, but more detail gives a better assessment.";
  }

  return (
    <p
      className={`mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm ${tone}`}
    >
      <span>{advice}</span>
      <span className="tabular-nums">
        {value.length.toLocaleString()} / {DESC_MAX.toLocaleString()}
      </span>
    </p>
  );
}

export default function AssessmentForm({
  onSubmit,
  // Pre-fills the form from a previous assessment's input, for "revise and
  // re-run". Only read on mount — this form is never reset from outside.
  initialValues,
  submitLabel = "Run assessment",
}) {
  const [form, setForm] = useState(() => ({ ...INITIAL, ...initialValues }));
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);

  const errors = validate(form);
  const errorCount = Object.keys(errors).length;

  // A field shows its error once it has been visited, or after a submit try.
  const showError = (field) =>
    (submitted || touched[field]) && errors[field] ? errors[field] : undefined;

  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Data types: "none" is mutually exclusive with every specific type.
  function toggleDataType(value) {
    markTouched("data_types");
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
    markTouched("geographic_scope");
    setForm((f) => ({
      ...f,
      geographic_scope: f.geographic_scope.includes(value)
        ? f.geographic_scope.filter((s) => s !== value)
        : [...f.geographic_scope, value],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);

    if (Object.keys(errors).length > 0) {
      // Send focus to the first problem rather than leaving the user to hunt.
      const first = Object.keys(errors)[0];
      const el =
        formRef.current?.querySelector(`#${first}`) ??
        formRef.current?.querySelector(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus?.({ preventScroll: true });
      return;
    }

    onSubmit({
      ...form,
      project_name: form.project_name.trim() || "Untitled project",
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
    >
      {submitted && errorCount > 0 && (
        <Banner tone="error" title="Not quite ready.">
          {errorCount === 1
            ? "One field needs attention before the screening can run."
            : `${errorCount} fields need attention before the screening can run.`}
        </Banner>
      )}

      <Section
        step={1}
        title="About the system"
        description="What the system does and where it sits in the organisation."
      >
        <Field
          label="Project name"
          htmlFor="project_name"
          hint="Used to identify this assessment in your list. Defaults to “Untitled project”."
          error={showError("project_name")}
        >
          <TextInput
            id="project_name"
            maxLength={NAME_MAX}
            placeholder="e.g. Candidate Screening Assistant"
            value={form.project_name}
            invalid={Boolean(showError("project_name"))}
            onChange={(e) => update("project_name", e.target.value)}
            onBlur={() => markTouched("project_name")}
          />
        </Field>

        <div>
          <Field
            label="What does the system do?"
            htmlFor="use_case_description"
            required
            error={showError("use_case_description")}
          >
            <Textarea
              id="use_case_description"
              rows={7}
              placeholder="What does the system do? Who uses it, on whom, and to make what decisions? Include how its output is acted on — whether a human reviews it, and what happens to the person it is about."
              value={form.use_case_description}
              invalid={Boolean(showError("use_case_description"))}
              onChange={(e) => update("use_case_description", e.target.value)}
              onBlur={() => markTouched("use_case_description")}
            />
          </Field>
          {!showError("use_case_description") && (
            <DescriptionCounter value={form.use_case_description} />
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Industry / domain"
            htmlFor="industry"
            hint="Some sectors carry sector-specific duties on top of the general regimes."
          >
            <Select
              id="industry"
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
            >
              {INDUSTRIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Deployment context"
            htmlFor="deployment_context"
            hint="Public-sector and safety-critical uses are held to stricter obligations."
          >
            <Select
              id="deployment_context"
              value={form.deployment_context}
              onChange={(e) => update("deployment_context", e.target.value)}
            >
              {DEPLOYMENT_CONTEXTS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        step={2}
        title="Data & context"
        description="What the system processes, and whether its output lands on a person."
      >
        <Field
          label="Data types used"
          required
          hint="Drives the GDPR analysis. Special-category data (biometric, health) raises the bar sharply."
          error={showError("data_types")}
        >
          <OptionGrid min="11rem">
            {DATA_TYPES.map((opt) => (
              <OptionTile
                key={opt}
                data-field={opt === DATA_TYPES[0] ? "data_types" : undefined}
                checked={form.data_types.includes(opt)}
                onChange={() => toggleDataType(opt)}
              >
                {opt}
              </OptionTile>
            ))}
          </OptionGrid>
        </Field>

        <Field
          label="Does it affect decisions about people?"
          hint="Eligibility, access, pricing, hiring, or anything else with a consequence for an individual. This is often what tips a system into the EU AI Act's high-risk category."
        >
          <div className="flex gap-2">
            {[
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ].map(({ value, label }) => (
              <OptionTile
                key={label}
                type="radio"
                name="affects_decisions"
                className="flex-1 sm:flex-none sm:min-w-28"
                checked={form.affects_decisions === value}
                onChange={() => update("affects_decisions", value)}
              >
                {label}
              </OptionTile>
            ))}
          </div>
        </Field>
      </Section>

      <Section
        step={3}
        title="Scope"
        description="Where the system operates — this decides which regimes are in play at all."
      >
        <Field
          label="Geographic scope"
          required
          hint="The EU AI Act and GDPR reach any system affecting people in the EU, wherever it is run."
          error={showError("geographic_scope")}
        >
          <OptionGrid min="7rem">
            {GEOGRAPHIC_SCOPES.map((opt) => (
              <OptionTile
                key={opt}
                data-field={
                  opt === GEOGRAPHIC_SCOPES[0] ? "geographic_scope" : undefined
                }
                checked={form.geographic_scope.includes(opt)}
                onChange={() => toggleScope(opt)}
              >
                {opt}
              </OptionTile>
            ))}
          </OptionGrid>
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg">
          {submitLabel}
        </Button>
        <p className="text-sm text-muted">Takes 10–60 seconds.</p>
      </div>
    </form>
  );
}
