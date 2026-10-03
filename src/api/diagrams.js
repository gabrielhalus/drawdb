import { REDIRECT_PARAM } from "../utils/authRedirect";

const JSON_HEADERS = { "Content-Type": "application/json" };

const AUTH_PATHS = ["/sign-in", "/sign-up"];

/**
 * Sends the visitor back to the sign-in screen after the session went away.
 *
 * A session can expire or be revoked while the editor is open, and no screen
 * can recover from that on its own — every diagram request would keep failing.
 * The reload also drops the editor state belonging to the old session.
 */
function handleSessionLoss() {
  const { pathname, search } = window.location;
  if (AUTH_PATHS.some((path) => pathname.startsWith(path))) return;
  const next = encodeURIComponent(`${pathname}${search}`);
  window.location.assign(`/sign-in?${REDIRECT_PARAM}=${next}`);
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    handleSessionLoss();
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

/** Resolves to null on 404 instead of throwing, for "may not exist" lookups. */
async function optional(url) {
  try {
    return await request(url);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

const diagramUrl = (id) => `/api/diagrams/${encodeURIComponent(id)}`;

export const diagramApi = {
  async list() {
    const { diagrams } = await request("/api/diagrams");
    return diagrams;
  },
  async listFull() {
    const { diagrams } = await request("/api/diagrams?full=1");
    return diagrams;
  },
  get(id) {
    return optional(diagramUrl(id));
  },
  latest() {
    return optional("/api/diagrams/latest");
  },
  findByGistId(gistId) {
    return optional(`/api/diagrams/by-gist/${encodeURIComponent(gistId)}`);
  },
  create(diagram) {
    return request("/api/diagrams", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(diagram),
    });
  },
  update(id, patch) {
    return request(diagramUrl(id), {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    });
  },
  delete(id) {
    return request(diagramUrl(id), { method: "DELETE" });
  },
};
