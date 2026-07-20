import { cx } from "./cx.js";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold " +
  "border transition-colors cursor-pointer select-none " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const VARIANTS = {
  primary:
    "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary:
    "bg-surface text-accent border-line-strong hover:bg-accent-soft hover:border-accent-line",
  ghost:
    "bg-transparent text-muted border-transparent hover:text-ink hover:bg-sunken",
  danger: "bg-risk-high-fg text-white border-risk-high-fg hover:brightness-90",
};

const SIZES = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-5 py-3",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A button that is visually a link — used for inline mode switches. */
export function LinkButton({ className, children, ...rest }) {
  return (
    <button
      type="button"
      className={cx(
        "font-semibold text-accent underline underline-offset-2 hover:text-accent-hover cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
