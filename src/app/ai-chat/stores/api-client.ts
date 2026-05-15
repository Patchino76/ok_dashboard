import { getCurrentRole } from "./role-store";

/**
 * Fetch wrapper that injects the current role as `X-User-Role` on every
 * request. All calls to /api/v1/agentic/* in the AI Chat page MUST go
 * through this helper so the backend can scope reads/writes by role.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("X-User-Role")) {
    headers.set("X-User-Role", getCurrentRole());
  }
  return fetch(input, { ...init, headers });
}
