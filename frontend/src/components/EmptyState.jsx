// Shared "nothing here yet" panel. Always offers the next action rather than
// just reporting absence.
import Card from "./ui/Card.jsx";

export default function EmptyState({ icon: IconCmp, title, message, action }) {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      {IconCmp && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <IconCmp className="h-6 w-6" />
        </span>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {message && (
        <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}
