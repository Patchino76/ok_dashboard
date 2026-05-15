import { NextRequest, NextResponse } from "next/server";

// Explicit proxy for POST /api/v1/agentic/followup/{id}
// Previously this path fell through the next.config.js fallback rewrite, which
// sporadically returned HTTP 500 without reaching FastAPI (likely a dev-server
// upstream fetch failure). Having a real route handler here gives us:
//   - visible console logs in the Next.js dev output,
//   - deterministic JSON error bodies (never a bare HTML 500 page),
//   - the ability to distinguish "upstream unreachable" from "upstream 500".

const API_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

// Retry transient connection failures once. After a FastAPI restart Node's
// global fetch Agent may still hold a half-dead TCP socket from the prior
// process — the first POST fails on that stale socket, the second opens a
// fresh one. Retrying once therefore turns the well-known "first 502 / second
// 200" pattern into a single transparent success.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[followup-proxy] first attempt failed (${msg}); retrying once…`,
    );
    // Tiny delay to let the OS retire the dead socket before we open a new one.
    await new Promise((r) => setTimeout(r, 100));
    return await fetch(url, init);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const startedAt = Date.now();

  // Read body once (NextRequest body can only be read once).
  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[followup-proxy] ${id} failed reading request body:`, msg);
    return NextResponse.json(
      { error: "Bad request", detail: `Unable to read request body: ${msg}` },
      { status: 400 },
    );
  }

  // Forward the original query string (e.g. ?role=manager) verbatim.
  const incomingQuery = request.nextUrl.search || "";
  const upstreamUrl = `${API_URL}/api/v1/agentic/followup/${encodeURIComponent(id)}${incomingQuery}`;

  // Forward the role header (the only custom header the backend cares about).
  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const roleHeader = request.headers.get("x-user-role");
  if (roleHeader) upstreamHeaders["X-User-Role"] = roleHeader;

  console.log(
    `[followup-proxy] → ${upstreamUrl} (${bodyText.length} bytes, role=${roleHeader || "<none>"})`,
  );

  let upstream: Response;
  try {
    upstream = await fetchWithRetry(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: bodyText,
      // Avoid Node's default keep-alive pooling reusing a dead socket.
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `[followup-proxy] ${id} upstream fetch FAILED after ${Date.now() - startedAt} ms:`,
      msg,
    );
    return NextResponse.json(
      {
        error: "Upstream unreachable",
        detail: `Could not reach FastAPI at ${upstreamUrl}: ${msg}`,
      },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  const text = await upstream.text();
  console.log(
    `[followup-proxy] ← ${upstream.status} ${contentType} (${text.length} bytes, ${Date.now() - startedAt} ms)`,
  );

  // Try to parse as JSON; if it isn't, wrap it so the client always sees a
  // structured body with a useful `detail` field.
  if (contentType.includes("application/json")) {
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: upstream.status });
    } catch (e) {
      console.error(`[followup-proxy] ${id} JSON parse error:`, e);
    }
  }

  return NextResponse.json(
    {
      error: "Upstream returned non-JSON response",
      detail: text.slice(0, 500),
      upstream_status: upstream.status,
    },
    { status: upstream.status >= 400 ? upstream.status : 502 },
  );
}
