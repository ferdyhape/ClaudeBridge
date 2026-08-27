// Same-origin fetch wrappers — in production the built app is served by
// the same Express server as the API, and in dev Vite proxies these paths
// to it (see vite.config.js), so no base URL is ever needed.

async function request(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function apiGet(path) {
  return request(path);
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}
