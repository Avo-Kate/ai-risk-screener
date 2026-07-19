// Thin client for the backend API. Uses relative /api URLs; in development the
// Vite dev server proxies these to the FastAPI backend on :8000.
//
// Every request carries the Supabase access token as a Bearer header; the
// backend verifies it and scopes the response to the signed-in user.

import { supabase } from "./supabaseClient.js";

const BASE = "/api";

async function authHeaders() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}), ...(await authHeaders()) };
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      "Could not reach the backend. Make sure the API server is running on port 8000.",
    );
  }

  if (!response.ok) {
    // The backend returns { detail: "..." } for handled errors.
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      /* non-JSON error body; keep the default message */
    }
    throw new Error(detail);
  }

  return response.json();
}

export function createAssessment(input) {
  return request("/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function listAssessments() {
  return request("/assessments");
}

export function getAssessment(id) {
  return request(`/assessments/${id}`);
}

export function getHealth() {
  return request("/health");
}

// Deletes all of the caller's app data (assessments + profile row). The
// Supabase login itself is unaffected — see AccountPage for the user-facing
// explanation.
export function deleteMyData() {
  return request("/me", { method: "DELETE" });
}
