// Confirmation modal for destructive actions.
//
// Built on the native <dialog> element with showModal(), which gives the focus
// trap, the Escape-to-close behaviour and the inert backdrop for free — all
// things a hand-rolled div modal usually gets wrong.
import { useEffect, useRef } from "react";
import Button from "./Button.jsx";

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape fires the dialog's own close event; route it back to the caller so
  // the two stay in step.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCancel?.();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onCancel]);

  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/40"
      onCancel={(e) => {
        e.preventDefault();
        onCancel?.();
      }}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <div className="mt-2 text-sm text-ink-soft">{children}</div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
