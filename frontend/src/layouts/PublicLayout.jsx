// Slim shell for signed-out routes (/login, /reset-password): header without
// navigation, no user area, same footer.
import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1>AI Governance Risk Assessment</h1>
            <p className="tagline">
              Screen an AI use case against the EU AI Act, NIST AI RMF, GDPR,
              and ISO/IEC 42001.
            </p>
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      <footer className="app-footer">
        Decision-support tool — not legal advice. Validate findings with
        qualified legal and compliance professionals.
      </footer>
    </div>
  );
}
