// Form primitives.
//
// Focus styling is deliberately absent here: theme.css sets one app-wide
// `:focus-visible` outline, which browsers also apply to text fields on click.
// Controls only add a border colour change on top of it.
import { cloneElement, isValidElement, useId } from "react";
import { cx } from "./cx.js";

const CONTROL =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-ink " +
  "placeholder:text-muted/70 focus:border-accent";

const controlTone = (invalid) =>
  invalid ? "border-risk-high-fg" : "border-line-strong";

/**
 * Label + control + hint/error wrapper.
 *
 * Pass `hint` to explain what the field influences — 2.3 asks for helper text
 * on every field so a first-time user is never guessing. When `error` is set it
 * replaces the hint, so the two never stack.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}) {
  // Groups of tiles (data types, geographic scope) have no single control to
  // point a label at, so they get a generated id and a role="group" wrapper
  // instead of an htmlFor.
  const generatedId = useId();
  const baseId = htmlFor || generatedId;
  const messageId = error
    ? `${baseId}-error`
    : hint
      ? `${baseId}-hint`
      : undefined;

  // Attach the hint/error to the control itself so screen readers announce it
  // with the field rather than leaving it as loose text nearby.
  const described = htmlFor ? (
    isValidElement(children) ? (
      cloneElement(children, {
        "aria-describedby":
          [children.props["aria-describedby"], messageId]
            .filter(Boolean)
            .join(" ") || undefined,
      })
    ) : (
      children
    )
  ) : (
    <div role="group" aria-label={label} aria-describedby={messageId}>
      {children}
    </div>
  );

  return (
    <div className={cx("min-w-0", className)}>
      {label &&
        (htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="mb-1.5 block text-sm font-semibold text-ink"
          >
            {label}
            {required && (
              <span className="text-risk-high-fg" aria-hidden="true">
                {" "}
                *
              </span>
            )}
          </label>
        ) : (
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
            {required && (
              <span className="text-risk-high-fg" aria-hidden="true">
                {" "}
                *
              </span>
            )}
          </span>
        ))}

      {described}

      {error ? (
        <p
          id={messageId}
          className="mt-1.5 text-sm text-risk-high-fg"
          role="alert"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="mt-1.5 text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextInput({ invalid, className, ...rest }) {
  return (
    <input
      className={cx(CONTROL, controlTone(invalid), className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({ invalid, className, ...rest }) {
  return (
    <textarea
      className={cx(CONTROL, controlTone(invalid), "resize-y", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({ invalid, className, children, ...rest }) {
  return (
    <select
      className={cx(CONTROL, controlTone(invalid), "cursor-pointer", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/**
 * A checkbox or radio rendered as a selectable tile. The real input stays in
 * the DOM (keyboard + screen readers work normally); the tile is the label.
 */
export function OptionTile({
  type = "checkbox",
  checked,
  className,
  children,
  ...rest
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
        checked
          ? "border-accent-line bg-accent-soft font-semibold text-accent"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-sunken",
        className,
      )}
    >
      <input
        type={type}
        checked={checked}
        className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
        {...rest}
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

/** Groups tiles into a responsive grid. */
export function OptionGrid({ min = "12rem", className, children }) {
  return (
    <div
      className={cx("grid gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}
