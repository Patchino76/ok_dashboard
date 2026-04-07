import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string; filename: string }> },
) {
  try {
    const { analysisId, filename } = await params;
    const response = await fetch(
      `${API_URL}/api/v1/agentic/reports/${encodeURIComponent(analysisId)}/${encodeURIComponent(filename)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `File not found: ${filename}` },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    // For images, stream the binary data through
    if (contentType.startsWith("image/")) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // For text/markdown, return as text
    const text = await response.text();
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic reports proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
