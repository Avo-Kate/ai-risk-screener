// Shell for signed-out routes (/login, /reset-password): a centred column with
// the product mark above the card and the disclaimer below it.
import { Outlet } from "react-router-dom";
import { ShieldIcon } from "../components/ui/icons.jsx";

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
              <ShieldIcon className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-semibold text-ink">
              AI Governance Risk Screener
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Screen an AI use case against the EU AI Act, NIST AI RMF, GDPR and
              ISO/IEC 42001.
            </p>
          </div>

          <Outlet />
        </div>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-muted">
        Decision-support tool — not legal advice.
      </footer>
    </div>
  );
}
