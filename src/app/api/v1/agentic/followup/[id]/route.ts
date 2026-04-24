import { NextRequest, NextResponse } from "next/server";

// Explicit proxy for POST /api/v1/agentic/followup/{id}
// Previously this path fell through the next.config.js fallback rewrite, which
// sporadically returned HTTP 500 without reaching FastAPI (likely a dev-server
// upstream fetch failure). Having a real route handler here gives us:
//   - visible console logs in the Next.js dev output,
//   - deterministic JSON error bodies (never a bare HTML 500 page),
//   - the ability to distinguish "upstream unreachable" from "upstream 500".

const API_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

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

  const upstreamUrl = `${API_URL}/api/v1/agentic/followup/${encodeURIComponent(id)}`;
  console.log(`[followup-proxy] → ${upstreamUrl} (${bodyText.length} bytes)`);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
