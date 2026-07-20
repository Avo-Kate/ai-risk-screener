// The app's primary surface. Structure comes from a hairline border plus a
// barely-there shadow — see the design direction note in theme.css.
import { cx } from "./cx.js";

export default function Card({
  as: Tag = "div",
  padded = true,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        "rounded-xl border border-line bg-surface shadow-card print:break-inside-avoid print:shadow-none",
        padded && "p-5 sm:p-6",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Heading + optional supporting line, used at the top of a card or page. */
export function SectionHeading({ title, description, actions, className }) {
  return (
    <div
      className={cx("flex items-start justify-between gap-4 mb-4", className)}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted max-w-prose">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

/** Small uppercase label above a value or list. */
export function Eyebrow({ children, className }) {
  return (
    <span
      className={cx(
        "block text-xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
