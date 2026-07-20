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
    // No response at all — the backend is down or unreachable.
    const err = new Error(
      "Could not reach the backend. Make sure the API server is running on port 8000.",
    );
    err.status = 0;
    throw err;
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
    // The status is carried on the error so the UI can explain *which* kind of
    // failure happened (see ErrorState.jsx) rather than echoing raw detail.
    const err = new Error(detail);
    err.status = response.status;
    throw err;
  }

  // 204 (and any empty body) has nothing to parse — DELETE returns one.
  if (response.status === 204) return null;
  return response.json();
}

export function createAssessment(input) {
  return request("/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/**
 * List assessments as a page: `{ items, total, limit, offset }`.
 *
 * Accepts the backend's query params. `riskLevel` and `industry` are arrays and
 * are sent as repeated params, which is what FastAPI expects for `list[str]`.
 * Empty values are dropped so the URL only carries filters that are actually
 * set.
 */
export function listAssessments({
  q,
  riskLevel,
  industry,
  createdAfter,
  createdBefore,
  archived,
  sort,
  order,
  limit,
  offset,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  (riskLevel || []).forEach((v) => params.append("risk_level", v));
  (industry || []).forEach((v) => params.append("industry", v));
  if (createdAfter) params.set("created_after", createdAfter);
  if (createdBefore) params.set("created_before", createdBefore);
  // Only sent when true — the backend defaults to the active list.
  if (archived) params.set("archived", "true");
  if (sort) params.set("sort", sort);
  if (order) params.set("order", order);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));

  const qs = params.toString();
  return request(`/assessments${qs ? `?${qs}` : ""}`);
}

export function getAssessment(id) {
  return request(`/assessments/${id}`);
}

/**
 * Re-run an assessment with revised inputs, saved as the next version.
 * The earlier version is left intact and stays reachable via listVersions.
 */
export function reviseAssessment(id, input) {
  return request(`/assessments/${id}/revise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Every version of this assessment's family, newest first. */
export function listVersions(id) {
  return request(`/assessments/${id}/versions`);
}

/** Archive or restore an assessment. Archived rows are hidden, never deleted. */
export function setArchived(id, archived) {
  return request(`/assessments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived }),
  });
}

/** Permanently delete an assessment. Irreversible — confirm before calling. */
export function deleteAssessment(id) {
  return request(`/assessments/${id}`, { method: "DELETE" });
}

export function getHealth() {
  return request("/health");
}

/** Dashboard aggregates for the signed-in user. */
export function getStats({ months } = {}) {
  return request(`/stats${months ? `?months=${months}` : ""}`);
}

// Deletes all of the caller's app data (assessments + profile row). The
// Supabase login itself is unaffected — see AccountPage for the user-facing
// explanation.
export function deleteMyData() {
  return request("/me", { method: "DELETE" });
}
