// Primary navigation.
//
// One component serves both breakpoints: from `lg` up it is a fixed rail; below
// that it is an off-canvas drawer opened from the top bar. AppLayout owns the
// open/closed state so the top bar's button and the route change can both close
// it.
import { NavLink } from "react-router-dom";
import {
  ArchiveIcon,
  CloseIcon,
  DashboardIcon,
  NewAssessmentIcon,
  ShieldIcon,
  UserIcon,
} from "../components/ui/icons.jsx";
import { cx } from "../components/ui/cx.js";

const NAV = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/new", label: "New assessment", icon: NewAssessmentIcon },
  { to: "/assessments", label: "Past assessments", icon: ArchiveIcon },
  { to: "/account", label: "Account", icon: UserIcon },
];

function navItemClass({ isActive }) {
  return cx(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-accent-soft text-accent font-semibold"
      : "text-ink-soft hover:bg-sunken hover:text-ink",
  );
}

function SidebarContent({ onNavigate, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">AI Risk</div>
            <div className="text-sm font-semibold text-ink">Screener</div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: IconCmp, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={navItemClass}
            onClick={onNavigate}
          >
            <IconCmp className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-muted">
        Screens against the EU AI Act, NIST AI RMF, GDPR and ISO/IEC 42001.
        Decision support — not legal advice.
      </p>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Fixed rail — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block print:hidden">
        <SidebarContent />
      </aside>

      {/* Drawer — mobile / tablet */}
      <div
        className={cx(
          "fixed inset-0 z-40 lg:hidden print:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cx(
            "absolute inset-0 bg-ink/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
        />
        <aside
          className={cx(
            "absolute inset-y-0 left-0 w-64 border-r border-line bg-surface shadow-raised transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarContent onNavigate={onClose} onClose={onClose} />
        </aside>
      </div>
    </>
  );
}
