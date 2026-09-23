// One place that knows how to talk to the FastAPI backend.
// Pages import these functions instead of calling fetch() directly —
// keeps the URL/error-handling logic in one spot.

const BASE_URL = "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ? (typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)) : `status ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

// Reads the admin secret from sessionStorage, prompting once per browser
// session if it isn't set yet.
function getAdminSecret() {
  let secret = sessionStorage.getItem("adminSecret");
  if (!secret) {
    secret = window.prompt("Enter admin secret:");
    if (secret) sessionStorage.setItem("adminSecret", secret);
  }
  return secret;
}

// Like request(), but attaches the admin header and retries once if the
// server rejects it with 403 (wrong/stale secret). Throws if the user
// cancels the prompt, so calling components can catch it and show a message.
async function adminFetch(path, options = {}) {
  const secret = getAdminSecret();
  if (!secret) throw new Error("Admin secret required to perform this action");

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...options.headers, "X-Admin-Secret": secret },
  });

  if (res.status === 403) {
    sessionStorage.removeItem("adminSecret");
    const retrySecret = getAdminSecret();
    if (!retrySecret) throw new Error("Admin secret required to perform this action");
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...options.headers, "X-Admin-Secret": retrySecret },
    });
  }

  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}

// --- User authentication (JWT-based, separate from the admin secret) ---
// Stored in localStorage (not sessionStorage) so the user stays logged in
// across browser restarts, not just within one tab session.

function getAuthToken() {
  return localStorage.getItem("authToken");
}

export function setAuthToken(token) {
  localStorage.setItem("authToken", token);
}

export function clearAuthToken() {
  localStorage.removeItem("authToken");
}

// Like request(), but attaches the logged-in user's token. Used for every
// route that needs to know WHO is calling (quiz submit, tags, favourites,
// stats) — distinct from adminFetch, which uses the shared admin secret.
async function authFetch(path, options = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("You must be logged in to do that");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",   // NEW — without this, the body is sent as text/plain
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearAuthToken();
    throw new Error("Session expired — please log in again");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ? JSON.stringify(body.detail) : `status ${res.status}`;
    throw new Error(`API error on ${path}: ${detail}`);
  }
  return res.json();
}


export async function signup(email, password) {
  const data = await request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  return data;
}

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  return data;
}

export function getCategories() {
  return request("/categories");
}

export function getSubcategories(category) {
  return request(`/subcategories?category=${encodeURIComponent(category)}`);
}

export function getTopics(category, subcategory) {
  const params = new URLSearchParams({ category });
  if (subcategory) params.append("subcategory", subcategory);
  return request(`/topics?${params}`);
}

export function getQuizQuestions(filters) {
  const params = new URLSearchParams(filters);
  return request(`/questions/quiz?${params}`);
}

export function getPrepareQuestions(filters) {
  const params = new URLSearchParams(filters);
  return request(`/questions/prepare?${params}`);
}

// --- Routes requiring a logged-in user — via authFetch ---

export function submitQuiz(payload) {
  return authFetch("/quiz/submit", { method: "POST", body: JSON.stringify(payload) });
}

export function assignTag(questionId, name) {
  return authFetch(`/questions/${questionId}/tags`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function setFavourite(questionId, favourite) {
  return authFetch(`/questions/${questionId}/favourite`, {
    method: "PATCH",
    body: JSON.stringify({ favourite }),
  });
}

export function getFavourites() {
  return authFetch("/questions/favourites");
}

export function getQuestionsByTag(tagId) {
  return authFetch(`/questions/by-tag?tag_id=${tagId}`);
}

export function getSessionStats() {
  return authFetch("/stats/sessions");
}

export function getStatsOverview() {
  return authFetch("/stats/overview");
}

// --- Admin / LLM routes — all gated via adminFetch instead of request() ---

export async function uploadJsonl(file) {
  const formData = new FormData();
  formData.append("file", file);
  return adminFetch("/admin/load", { method: "POST", body: formData });
}

export function generateQuestions(payload) {
  return adminFetch("/admin/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function commitGenerated(items) {
  return adminFetch("/admin/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

export function explainQuestion(questionId, customInstruction) {
  return adminFetch(`/questions/${questionId}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_instruction: customInstruction || null }),
  });
}

export function getContentOverview() {
  return adminFetch("/admin/content-overview");
}

// --- Everything else, unchanged (no login required) ---

export function getAllTags() {
  return request("/tags");
}