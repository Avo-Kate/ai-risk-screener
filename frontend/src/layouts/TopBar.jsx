// Top bar: drawer toggle (below `lg`), current page title, and the user menu.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronIcon,
  LogoutIcon,
  MenuIcon,
  UserIcon,
} from "../components/ui/icons.jsx";
import { cx } from "../components/ui/cx.js";

function UserMenu({ email, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click or Escape — the menu is not modal.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex max-w-[13rem] items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-sunken hover:text-ink sm:max-w-xs"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <UserIcon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{email}</span>
        <ChevronIcon
          className={cx(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-raised"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-xs text-muted">Signed in as</p>
            <p
              className="truncate text-sm font-semibold text-ink"
              title={email}
            >
              {email}
            </p>
          </div>
          <Link
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft hover:bg-sunken hover:text-ink"
          >
            <UserIcon className="h-4 w-4" />
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-soft hover:bg-sunken hover:text-ink"
          >
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function TopBar({ title, email, onOpenNav, onLogout }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenNav}
          className="-ml-1 rounded-lg p-2 text-ink-soft hover:bg-sunken hover:text-ink lg:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
          {title}
        </h1>

        <UserMenu email={email} onLogout={onLogout} />
      </div>
    </header>
  );
}
