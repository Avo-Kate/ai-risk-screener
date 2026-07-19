import { useState } from "react";
import { supabase, supabaseConfigured } from "../supabaseClient.js";

// Email + password sign in / sign up via Supabase Auth. Supabase owns the
// credentials; on success it establishes a session and App reacts to it.
export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  if (!supabaseConfigured) {
    return (
      <div className="auth-card">
        <h2>Sign in</h2>
        <div className="banner banner-warning">
          <strong>Authentication is not configured.</strong> Set{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{" "}
          in <code>frontend/.env</code> (see <code>frontend/.env.example</code>)
          and restart the dev server.
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          setNotice(
            "Account created. Check your email to confirm, then sign in.",
          );
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      // On success with a session, App's onAuthStateChange swaps in the app.
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>{mode === "signup" ? "Create an account" : "Sign in"}</h2>
      <p className="auth-sub">Your assessments are private to your account.</p>

      {notice && <div className="banner banner-warning">{notice}</div>}
      {error && (
        <div className="banner banner-error">
          <strong>
            Could not {mode === "signup" ? "sign up" : "sign in"}.
          </strong>{" "}
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Working…" : mode === "signup" ? "Sign up" : "Sign in"}
        </button>
      </form>

      <p className="auth-toggle">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button className="link" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        ) : (
          <>
            No account?{" "}
            <button className="link" onClick={() => setMode("signup")}>
              Create one
            </button>
          </>
        )}
      </p>
    </div>
  );
}
