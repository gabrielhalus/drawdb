const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(url, options) {
  const response = await fetch(url, options);
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
