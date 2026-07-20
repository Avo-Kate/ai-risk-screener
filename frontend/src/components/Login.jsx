import { useState } from "react";
import { supabase, supabaseConfigured } from "../supabaseClient.js";
import Banner, { Code } from "./ui/Banner.jsx";
import Button, { LinkButton } from "./ui/Button.jsx";
import Card from "./ui/Card.jsx";
import { Field, TextInput } from "./ui/Form.jsx";

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

const SUBTITLES = {
  signin: "Your assessments are private to your account.",
  signup: "Your assessments are private to your account.",
  forgot: "Enter your email and we will send you a password reset link.",
};

const SUBMIT_LABELS = {
  signin: "Sign in",
  signup: "Sign up",
  forgot: "Send reset link",
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
      <Card>
        <h2 className="mb-3 text-xl font-semibold text-ink">Sign in</h2>
        <Banner tone="warning" title="Authentication is not configured.">
          Set <Code>VITE_SUPABASE_URL</Code> and{" "}
          <Code>VITE_SUPABASE_ANON_KEY</Code> in <Code>frontend/.env</Code> (see{" "}
          <Code>frontend/.env.example</Code>) and restart the dev server.
        </Banner>
      </Card>
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
    <Card>
      <h2 className="text-xl font-semibold text-ink">{TITLES[mode]}</h2>
      <p className="mt-1 text-sm text-muted">{SUBTITLES[mode]}</p>

      {(notice || error) && (
        <div className="mt-4 space-y-3">
          {notice && <Banner tone="success">{notice}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
        </div>
      )}

      {showResend && (
        <p className="mt-4 text-sm text-muted">
          Did the email not arrive?{" "}
          <LinkButton onClick={handleResend} disabled={busy}>
            Resend confirmation email
          </LinkButton>
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {mode !== "forgot" && (
          <Field
            label="Password"
            htmlFor="password"
            hint={mode === "signup" ? "At least 6 characters." : undefined}
          >
            <TextInput
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Working…" : SUBMIT_LABELS[mode]}
        </Button>
      </form>

      <div className="mt-5 space-y-2 border-t border-line pt-4 text-center text-sm text-muted">
        {mode === "signin" && (
          <p>
            <LinkButton onClick={() => switchMode("forgot")}>
              Forgot password?
            </LinkButton>
          </p>
        )}
        <p>
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <LinkButton onClick={() => switchMode("signin")}>
                Sign in
              </LinkButton>
            </>
          ) : mode === "forgot" ? (
            <>
              Remembered it after all?{" "}
              <LinkButton onClick={() => switchMode("signin")}>
                Back to sign in
              </LinkButton>
            </>
          ) : (
            <>
              No account?{" "}
              <LinkButton onClick={() => switchMode("signup")}>
                Create one
              </LinkButton>
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
