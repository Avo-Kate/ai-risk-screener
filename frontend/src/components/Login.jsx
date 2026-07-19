import { useState } from "react";
import { supabase, supabaseConfigured } from "../supabaseClient.js";

// Email + password sign in / sign up / password reset via Supabase Auth.
// Supabase owns the credentials; on success it establishes a session and the
// router reacts to it (LoginPage redirects signed-in visitors).

// Map Supabase's terse error strings to actionable messages. Keys are matched
// case-insensitively as substrings.
const FRIENDLY_ERRORS = [
  {
    match: "invalid login credentials",
    message:
      "That email and password combination is not right. Double-check both, " +
      "or use “Forgot password?” below.",
  },
  {
    match: "email not confirmed",
    message:
      "This email address has not been confirmed yet. Use the link in the " +
      "confirmation email, or resend it below.",
  },
  {
    match: "user already registered",
    message: "An account with this email already exists — sign in instead.",
  },
];

function friendly(rawMessage) {
  const lower = (rawMessage || "").toLowerCase();
  const hit = FRIENDLY_ERRORS.find((f) => lower.includes(f.match));
  return hit ? hit.message : rawMessage || "Authentication failed.";
}

const TITLES = {
  signin: "Sign in",
  signup: "Create an account",
  forgot: "Reset your password",
};

export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Offer "resend confirmation" after an unconfirmed sign-in attempt or a
  // fresh sign-up while confirmation is pending.
  const [showResend, setShowResend] = useState(false);

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

  function switchMode(next) {
    setMode(next);
    setError(null);
    setNotice(null);
    setShowResend(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    setShowResend(false);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        // Deliberately the same message whether or not the account exists.
        setNotice(
          `If an account exists for ${email}, a reset link is on its way. ` +
            "The link opens a page where you choose a new password.",
        );
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          setNotice(
            "Account created — almost there. Open the confirmation link we " +
              "emailed you, then sign in.",
          );
          setShowResend(true);
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      // On success with a session, the router swaps in the app.
    } catch (err) {
      const msg = friendly(err.message);
      setError(msg);
      if ((err.message || "").toLowerCase().includes("not confirmed")) {
        setShowResend(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setNotice(`Confirmation email resent to ${email}.`);
      setShowResend(false);
    } catch (err) {
      setError(friendly(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>{TITLES[mode]}</h2>
      <p className="auth-sub">
        {mode === "forgot"
          ? "Enter your email and we will send you a password reset link."
          : "Your assessments are private to your account."}
      </p>

      {notice && <div className="banner banner-success">{notice}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {showResend && (
        <p className="auth-toggle">
          Did the email not arrive?{" "}
          <button className="link" onClick={handleResend} disabled={busy}>
            Resend confirmation email
          </button>
        </p>
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

        {mode !== "forgot" && (
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
            {mode === "signup" && (
              <span className="hint">At least 6 characters.</span>
            )}
          </label>
        )}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy
            ? "Working…"
            : mode === "signup"
              ? "Sign up"
              : mode === "forgot"
                ? "Send reset link"
                : "Sign in"}
        </button>
      </form>

      {mode === "signin" && (
        <p className="auth-toggle">
          <button className="link" onClick={() => switchMode("forgot")}>
            Forgot password?
          </button>
        </p>
      )}

      <p className="auth-toggle">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button className="link" onClick={() => switchMode("signin")}>
              Sign in
            </button>
          </>
        ) : mode === "forgot" ? (
          <>
            Remembered it after all?{" "}
            <button className="link" onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            No account?{" "}
            <button className="link" onClick={() => switchMode("signup")}>
              Create one
            </button>
          </>
        )}
      </p>
    </div>
  );
}
