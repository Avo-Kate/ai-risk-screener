// Shared date formatting, so every surface renders timestamps the same way.
// Uses the browser locale; the explicit option lists keep the output compact
// and unambiguous (a numeric-only date is read differently on each side of the
// Atlantic, which matters for a compliance artefact).

const DATE_OPTS = { day: "numeric", month: "short", year: "numeric" };
const TIME_OPTS = { hour: "2-digit", minute: "2-digit" };

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, DATE_OPTS);
}

export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, DATE_OPTS)}, ${d.toLocaleTimeString(
    undefined,
    TIME_OPTS,
  )}`;
}
