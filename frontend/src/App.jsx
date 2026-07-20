// Route table. Auth state lives in AuthProvider; AppLayout guards the
// signed-in routes and PublicLayout hosts /login and /reset-password.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import PublicLayout from "./layouts/PublicLayout.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import AssessmentDetailPage from "./pages/AssessmentDetailPage.jsx";
import AssessmentsListPage from "./pages/AssessmentsListPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NewAssessmentPage from "./pages/NewAssessmentPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import ReviseAssessmentPage from "./pages/ReviseAssessmentPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* "/" became the dashboard in Phase 2; the form moved to "/new". */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/new" element={<NewAssessmentPage />} />
            <Route path="/assessments" element={<AssessmentsListPage />} />
            <Route path="/assessments/:id" element={<AssessmentDetailPage />} />
            <Route
              path="/assessments/:id/revise"
              element={<ReviseAssessmentPage />}
            />
            <Route path="/account" element={<AccountPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
