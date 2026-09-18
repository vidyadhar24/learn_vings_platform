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
    throw new Error(`API error ${res.status} on ${path}`);
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

export function submitQuiz(payload) {
  return request("/quiz/submit", { method: "POST", body: JSON.stringify(payload) });
}

export function assignTag(questionId, name) {
  return request(`/questions/${questionId}/tags`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
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

// --- Everything else, unchanged ---

export function getSessionStats() {
  return request("/stats/sessions");
}

export function getStatsOverview() {
  return request("/stats/overview");
}

export function setFavourite(questionId, favourite) {
  return request(`/questions/${questionId}/favourite`, {
    method: "PATCH",
    body: JSON.stringify({ favourite }),
  });
}

export function getFavourites() {
  return request("/questions/favourites");
}

export function getAllTags() {
  return request("/tags");
}

export function getQuestionsByTag(tagId) {
  return request(`/questions/by-tag?tag_id=${tagId}`);
}