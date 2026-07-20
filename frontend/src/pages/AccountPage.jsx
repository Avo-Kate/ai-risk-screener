// "/account": profile, change password, change email, and app-data deletion.
//
// Password/email changes go straight to Supabase (it owns credentials).
// "Delete my data" calls the backend, which removes the user's assessments and
// local profile row — the Supabase login itself stays (this app deliberately
// holds no Supabase admin credential; see the note shown in the UI).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteMyData } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { explainError } from "../components/ErrorState.jsx";
import Banner from "../components/ui/Banner.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import { Field, TextInput } from "../components/ui/Form.jsx";
import { UserIcon } from "../components/ui/icons.jsx";
import { supabase } from "../supabaseClient.js";

/** A settings card: title, optional description, then the form. */
function SettingsCard({ title, description, danger, children }) {
  return (
    <Card
      as="section"
      className={danger ? "border-risk-high-solid/40" : undefined}
    >
      <h3
        className={`font-semibold ${danger ? "text-risk-high-fg" : "text-ink"}`}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-prose text-sm text-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default function AccountPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const email = session?.user?.email;

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Change email
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState(null);
  const [emailError, setEmailError] = useState(null);

  // Delete my data
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setPasswordBusy(false);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordNotice("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailError(null);
    setEmailNotice(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailBusy(false);
    if (error) {
      setEmailError(error.message);
    } else {
      setEmailNotice(
        "Confirmation email sent. The change takes effect once you confirm " +
          "it from your inbox.",
      );
      setNewEmail("");
    }
  }

  async function handleDeleteData() {
    const confirmed = window.confirm(
      "Delete all your assessments and profile data from this app? " +
        "This cannot be undone. You will be signed out.",
    );
    if (!confirmed) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMyData();
      await supabase?.auth.signOut();
      navigate("/login", { replace: true });
    } catch (e) {
      setDeleteError(explainError(e).body);
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card as="section" className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <UserIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Signed in as
          </p>
          <p className="truncate font-semibold text-ink">{email}</p>
        </div>
      </Card>

      <SettingsCard title="Change password">
        {passwordNotice && (
          <Banner tone="success" className="mb-4">
            {passwordNotice}
          </Banner>
        )}
        {passwordError && (
          <Banner tone="error" className="mb-4">
            {passwordError}
          </Banner>
        )}
        <form className="space-y-4" onSubmit={handleChangePassword}>
          <Field
            label="New password"
            htmlFor="account-new-password"
            hint="At least 6 characters."
          >
            <TextInput
              id="account-new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Repeat new password" htmlFor="account-confirm-password">
            <TextInput
              id="account-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={passwordBusy}>
            {passwordBusy ? "Working…" : "Update password"}
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Change email"
        description="You will be asked to confirm the new address from your inbox before it takes effect."
      >
        {emailNotice && (
          <Banner tone="success" className="mb-4">
            {emailNotice}
          </Banner>
        )}
        {emailError && (
          <Banner tone="error" className="mb-4">
            {emailError}
          </Banner>
        )}
        <form className="space-y-4" onSubmit={handleChangeEmail}>
          <Field label="New email address" htmlFor="account-new-email">
            <TextInput
              id="account-new-email"
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={emailBusy}>
            {emailBusy ? "Working…" : "Update email"}
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard
        danger
        title="Delete my data"
        description="Permanently deletes all your assessments and your profile data from this app. Your sign-in itself is managed by Supabase and is not removed — contact the administrator to delete the login entirely."
      >
        {deleteError && (
          <Banner tone="error" className="mb-4">
            {deleteError}
          </Banner>
        )}
        <Button
          variant="danger"
          onClick={handleDeleteData}
          disabled={deleteBusy}
        >
          {deleteBusy ? "Deleting…" : "Delete all my data"}
        </Button>
      </SettingsCard>
    </div>
  );
}
