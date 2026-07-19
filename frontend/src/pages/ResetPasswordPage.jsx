// "/reset-password": the page the Supabase recovery email links to.
//
// The email link carries a recovery token; supabase-js detects it in the URL
// and establishes a session automatically (detectSessionInUrl). This page then
// only has to collect the new password and call updateUser. Visiting without a
// valid recovery session (expired/used link, or typed in directly) shows a
// clear dead-end with a route back to sign-in.
//
// NOTE: the URL must be allow-listed in Supabase → Authentication → URL
// Configuration (e.g. http://localhost:5173/reset-password) or the email link
// will redirect to the Site URL instead.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { supabase, supabaseConfigured } from "../supabaseClient.js";

export default function ResetPasswordPage() {
  const { session, authReady } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  if (!supabaseConfigured) {
    return (
      <div className="auth-card">
        <h2>Reset password</h2>
        <div className="banner banner-warning">
          <strong>Authentication is not configured.</strong> Set{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{" "}
          in <code>frontend/.env</code> and restart the dev server.
        </div>
      </div>
    );
  }

  if (!authReady) {
    return <LoadingState title="Loading…" message="Checking your session." />;
  }

  if (!session) {
    return (
      <div className="auth-card">
        <h2>Reset password</h2>
        <div className="banner banner-warning">
          This reset link is invalid or has expired. You can request a new one
          from the <Link to="/login">sign-in page</Link> via “Forgot password?”.
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="auth-card">
        <h2>Password updated</h2>
        <p className="auth-sub">You are signed in with your new password.</p>
        <button
          className="btn-primary"
          onClick={() => navigate("/", { replace: true })}
        >
          Go to the app
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Choose a new password</h2>
      <p className="auth-sub">
        Setting a new password for{" "}
        <strong>{session.user?.email || "your account"}</strong>.
      </p>

      {error && (
        <div className="banner banner-error">
          <strong>Could not update the password.</strong> {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="hint">At least 6 characters.</span>
        </label>
        <label>
          Repeat new password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Working…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}
