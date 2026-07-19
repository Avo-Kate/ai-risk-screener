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
import { supabase } from "../supabaseClient.js";

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
      setDeleteError(e.message);
      setDeleteBusy(false);
    }
  }

  return (
    <div className="account">
      <div className="card account-card">
        <h2>Account</h2>
        <p className="muted">
          Signed in as <strong>{email}</strong>
        </p>
      </div>

      <div className="card account-card">
        <h3>Change password</h3>
        {passwordNotice && (
          <div className="banner banner-success">{passwordNotice}</div>
        )}
        {passwordError && (
          <div className="banner banner-error">{passwordError}</div>
        )}
        <form className="auth-form" onSubmit={handleChangePassword}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? "Working…" : "Update password"}
          </button>
        </form>
      </div>

      <div className="card account-card">
        <h3>Change email</h3>
        {emailNotice && (
          <div className="banner banner-success">{emailNotice}</div>
        )}
        {emailError && <div className="banner banner-error">{emailError}</div>}
        <form className="auth-form" onSubmit={handleChangeEmail}>
          <label>
            New email address
            <input
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={emailBusy}>
            {emailBusy ? "Working…" : "Update email"}
          </button>
        </form>
      </div>

      <div className="card account-card danger-zone">
        <h3>Delete my data</h3>
        <p className="muted">
          Permanently deletes all your assessments and your profile data from
          this app. Your sign-in itself is managed by Supabase and is not
          removed — contact the administrator to delete the login entirely.
        </p>
        {deleteError && (
          <div className="banner banner-error">{deleteError}</div>
        )}
        <button
          className="btn btn-danger"
          onClick={handleDeleteData}
          disabled={deleteBusy}
        >
          {deleteBusy ? "Deleting…" : "Delete all my data"}
        </button>
      </div>
    </div>
  );
}
