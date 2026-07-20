// Generic wait card, for short fetches (auth checks, loading a record).
// The long assessment run has its own component — see AssessmentProgress.jsx.
import Card from "./ui/Card.jsx";
import { cx } from "./ui/cx.js";

export function Spinner({ className = "h-9 w-9" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block animate-spin rounded-full border-[3px] border-accent-soft border-t-accent",
        className,
      )}
    />
  );
}

export default function LoadingState({
  title = "Loading…",
  message,
  className,
}) {
  return (
    <Card
      className={cx("flex flex-col items-center py-12 text-center", className)}
    >
      <Spinner />
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
    </Card>
  );
}
