// "/login": the sign-in/sign-up card. Already-signed-in visitors are sent to
// the page they originally asked for (preserved by AppLayout) or the workspace.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import Login from "../components/Login.jsx";

export default function LoginPage() {
  const { session, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return <LoadingState title="Loading…" message="Checking your session." />;
  }
  if (session) {
    return <Navigate to={location.state?.from?.pathname || "/"} replace />;
  }
  return <Login />;
}
