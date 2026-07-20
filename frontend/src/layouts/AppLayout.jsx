// Shell for all signed-in routes: sidebar + top bar + the routed page.
//
// Also the auth gate: unauthenticated visitors are redirected to /login with
// the original location preserved, so signing in returns them where they were.
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getHealth } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Banner, { Code } from "../components/ui/Banner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { supabase } from "../supabaseClient.js";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

// Page titles for the top bar. Matched longest-prefix-first so
// /assessments/:id wins over /assessments.
// Page titles for the top bar, matched in order — most specific first, since
// several share a prefix (/assessments/:id/revise vs /assessments/:id).
const TITLES = [
  [/^\/assessments\/[^/]+\/revise$/, "Revise assessment"],
  [/^\/assessments\/[^/]+$/, "Assessment"],
  [/^\/assessments$/, "Past assessments"],
  [/^\/account$/, "Account"],
  [/^\/new$/, "New assessment"],
  [/^\/$/, "Dashboard"],
];

function titleFor(pathname) {
  const hit = TITLES.find(([pattern]) => pattern.test(pathname));
  return hit ? hit[1] : "AI Risk Screener";
}

export default function AppLayout() {
  const { session, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const signedIn = Boolean(session);

  // Warn early if the backend has no API key. Runs again after each sign in.
  useEffect(() => {
    if (!signedIn) return;
    getHealth()
      .then((h) => setApiKeyMissing(!h.api_key_configured))
      .catch(() => {});
  }, [signedIn]);

  // A navigation always dismisses the mobile drawer.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <LoadingState
          title="Loading…"
          message="Checking your session."
          className="w-full max-w-md"
        />
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
    <div className="min-h-screen bg-canvas print:bg-white">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-64 print:pl-0">
        <TopBar
          title={titleFor(location.pathname)}
          email={session.user?.email}
          onOpenNav={() => setNavOpen(true)}
          onLogout={handleLogout}
        />

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">
          {apiKeyMissing && (
            <Banner
              tone="warning"
              title="API key not configured."
              className="mb-6"
            >
              Set <Code>ANTHROPIC_API_KEY</Code> in <Code>backend/.env</Code>{" "}
              and restart the backend to run new assessments. You can still
              browse past assessments.
            </Banner>
          )}
          <Outlet />
        </main>

        <footer className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8 print:hidden">
          <p className="border-t border-line pt-6 text-xs text-muted">
            Decision-support tool — not legal advice. Validate findings with
            qualified legal and compliance professionals.
          </p>
        </footer>
      </div>
    </div>
  );
}
