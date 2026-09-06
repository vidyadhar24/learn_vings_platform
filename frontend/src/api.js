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

// Separate from request() because file uploads use FormData, not JSON —
// the browser sets the correct multipart Content-Type header itself when
// it sees a FormData body, so we must NOT set "Content-Type: application/json"
// here the way request() does for everything else.
export async function uploadJsonl(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/admin/load`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
  return res.json();
}

export function generateQuestions(payload) {
  return request("/admin/generate", { method: "POST", body: JSON.stringify(payload) });
}

export function commitGenerated(items) {
  return request("/admin/commit", { method: "POST", body: JSON.stringify({ items }) });
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