import { getCurrentRole } from "./role-store";

/**
 * Fetch wrapper that passes the current role to the backend via BOTH:
 *  - the `X-User-Role` header (preferred), and
 *  - a `?role=` query-string parameter (fallback).
 *
 * The query-string fallback ensures the role survives any proxy / cache
 * layer that strips custom headers, and matches the same parameter the
 * backend accepts for native <img> / <a download> requests.
 *
 * All calls to /api/v1/agentic/* in the AI Chat page MUST go through
 * this helper so the backend can scope reads/writes by role.
 */
export function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const role = getCurrentRole();

  const headers = new Headers(init.headers || {});
  if (!headers.has("X-User-Role")) {
    headers.set("X-User-Role", role);
  }

  // Append `?role=` only if the URL doesn't already specify one.
  let url = input;
  const hasRoleParam = /[?&]role=/.test(url);
  if (!hasRoleParam) {
    url += (url.includes("?") ? "&" : "?") + "role=" + encodeURIComponent(role);
  }

  return fetch(url, { ...init, headers });
}
