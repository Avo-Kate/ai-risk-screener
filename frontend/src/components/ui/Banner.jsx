// Inline status messages. `tone` carries the meaning; the icon reinforces it so
// the message does not rely on colour alone.
import { cx } from "./cx.js";

const TONES = {
  info: "bg-accent-soft border-accent-line text-accent",
  success: "bg-risk-low-bg border-risk-low-solid/40 text-risk-low-fg",
  warning: "bg-risk-medium-bg border-risk-medium-solid/40 text-risk-medium-fg",
  error: "bg-risk-high-bg border-risk-high-solid/40 text-risk-high-fg",
};

const ICONS = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "!",
};

export default function Banner({ tone = "info", title, children, className }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        TONES[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold leading-none"
      >
        {ICONS[tone]}
      </span>
      <div className="min-w-0">
        {title && <strong className="font-semibold">{title}</strong>} {children}
      </div>
    </div>
  );
}

/** Inline `<code>` styling, used inside banners for env var names and paths. */
export function Code({ children }) {
  return (
    <code className="rounded bg-black/5 px-1.5 py-0.5 text-[0.86em] font-mono">
      {children}
    </code>
  );
}
