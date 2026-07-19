// Shell for all signed-in routes: header with navigation and user area,
// API-key warning banner, and the routed page in <Outlet />.
//
// Also the auth gate: unauthenticated visitors are redirected to /login with
// the original location preserved, so signing in returns them where they were.
import { useEffect, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { getHealth } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { supabase } from "../supabaseClient.js";

const tabClass = ({ isActive }) => (isActive ? "tab active" : "tab");

export default function AppLayout() {
  const { session, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const signedIn = Boolean(session);

  // Warn early if the backend has no API key. Runs again after each sign in.
  useEffect(() => {
    if (!signedIn) return;
    getHealth()
      .then((h) => setApiKeyMissing(!h.api_key_configured))
      .catch(() => {});
  }, [signedIn]);

  if (!authReady) {
    return (
      <div className="app">
        <main className="container">
          <LoadingState title="Loading…" message="Checking your session." />
        </main>
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  async function handleLogout() {
    await supabase?.auth.signOut();
    // Navigating unmounts every page component, so no per-user state survives
    // into the next account's session.
    navigate("/login", { replace: true });
  }

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
          <div className="header-right">
            <nav className="tabs">
              <NavLink to="/" end className={tabClass}>
                New assessment
              </NavLink>
              <NavLink to="/assessments" className={tabClass}>
                Past assessments
              </NavLink>
              <NavLink to="/account" className={tabClass}>
                Account
              </NavLink>
            </nav>
            <div className="user-area">
              <span className="user-email" title={session.user?.email}>
                {session.user?.email}
              </span>
              <button className="tab" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        {apiKeyMissing && (
          <div className="banner banner-warning">
            <strong>API key not configured.</strong> Set{" "}
            <code>ANTHROPIC_API_KEY</code> in <code>backend/.env</code> and
            restart the backend to run new assessments. You can still browse
            past assessments.
          </div>
        )}
        <Outlet />
      </main>

      <footer className="app-footer">
        Decision-support tool — not legal advice. Validate findings with
        qualified legal and compliance professionals.
      </footer>
    </div>
  );
}
