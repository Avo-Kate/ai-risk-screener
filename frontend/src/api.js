// Thin client for the backend API. Uses relative /api URLs; in development the
// Vite dev server proxies these to the FastAPI backend on :8000.

const BASE = "/api";

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error(
      "Could not reach the backend. Make sure the API server is running on port 8000."
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
