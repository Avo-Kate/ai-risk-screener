// Turns a thrown API error into a plain-language explanation.
//
// The backend's status codes are meaningful (documented in CLAUDE.md):
//   503  the server has no Anthropic API key configured
//   502  the model call failed, or the model would not return valid JSON
//   401  the session is no longer valid
//   0    (set by api.js) no response at all — backend unreachable
// Anything else falls back to the server's own detail message.
import { Link } from "react-router-dom";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";

/**
 * Maps a thrown API error to { title, body, detail }.
 *
 * Exported because not every failure should replace the page: a failed
 * assessment run keeps the filled-in form on screen and shows this copy in a
 * banner above it, so nothing the user typed is lost.
 */
export function explainError(error) {
  const status = error?.status;
  const detail = error?.message || "Unknown error.";

  if (status === 0) {
    return {
      title: "Cannot reach the server",
      body: "The app could not contact the backend. If you are running this locally, check that the API server is up on port 8000.",
      detail,
    };
  }
  if (status === 503) {
    return {
      title: "Assessments are unavailable right now",
      body: "The server is not configured with an API key for the assessment model, so new screenings cannot be run. Your saved assessments are unaffected.",
      detail,
    };
  }
  if (status === 502) {
    return {
      title: "The assessment could not be completed",
      body: "The model service failed to return a usable result. This is usually temporary — running the assessment again generally works. Nothing was saved and nothing was charged for a failed run.",
      detail,
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "Your session has expired",
      body: "Sign in again to continue. Your saved assessments are safe.",
      detail,
    };
  }
  if (status === 404) {
    return {
      title: "Not found",
      body: "This assessment does not exist, or it belongs to a different account.",
      detail,
    };
  }
  if (status === 422) {
    return {
      title: "The form could not be submitted",
      body: "The server rejected one of the values in the form. Check the fields and try again.",
      detail,
    };
  }
  return {
    title: "Something went wrong",
    body: "The request did not complete.",
    detail,
  };
}

export default function ErrorState({
  error,
  onRetry,
  retryLabel = "Try again",
}) {
  const { title, body, detail } = explainError(error);

  return (
    <Card className="border-risk-high-solid/30">
      <h2 className="text-lg font-semibold text-risk-high-fg">{title}</h2>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">{body}</p>

      {detail && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">
            Technical detail
          </summary>
          <p className="mt-2 rounded-lg bg-sunken p-3 font-mono text-xs break-words text-ink-soft">
            {detail}
          </p>
        </details>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
        <Link to="/assessments">
          <Button variant="secondary">Back to past assessments</Button>
        </Link>
      </div>
    </Card>
  );
}
