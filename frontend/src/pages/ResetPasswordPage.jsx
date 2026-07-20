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
import Banner, { Code } from "../components/ui/Banner.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { Field, TextInput } from "../components/ui/Form.jsx";
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
      <Card>
        <h2 className="mb-3 text-xl font-semibold text-ink">Reset password</h2>
        <Banner tone="warning" title="Authentication is not configured.">
          Set <Code>VITE_SUPABASE_URL</Code> and{" "}
          <Code>VITE_SUPABASE_ANON_KEY</Code> in <Code>frontend/.env</Code> and
          restart the dev server.
        </Banner>
      </Card>
    );
  }

  if (!authReady) {
    return <LoadingState message="Checking your session." />;
  }

  if (!session) {
    return (
      <Card>
        <h2 className="mb-3 text-xl font-semibold text-ink">Reset password</h2>
        <Banner tone="warning" title="This link is no longer valid.">
          Reset links expire, and can only be used once. Request a new one from
          the{" "}
          <Link to="/login" className="font-semibold underline">
            sign-in page
          </Link>{" "}
          via “Forgot password?”.
        </Banner>
      </Card>
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
      <Card>
        <h2 className="text-xl font-semibold text-ink">Password updated</h2>
        <p className="mt-1 text-sm text-muted">
          You are signed in with your new password.
        </p>
        <Button
          className="mt-5 w-full"
          onClick={() => navigate("/", { replace: true })}
        >
          Go to the app
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-ink">Choose a new password</h2>
      <p className="mt-1 text-sm text-muted">
        Setting a new password for{" "}
        <strong className="text-ink">
          {session.user?.email || "your account"}
        </strong>
        .
      </p>

      {error && (
        <Banner
          tone="error"
          title="Could not update the password."
          className="mt-4"
        >
          {error}
        </Banner>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <Field
          label="New password"
          htmlFor="new-password"
          hint="At least 6 characters."
        >
          <TextInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Repeat new password" htmlFor="confirm-password">
          <TextInput
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Working…" : "Set new password"}
        </Button>
      </form>
    </Card>
  );
}
