import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const response = await fetch(
      `${API_URL}/api/v1/agentic/followup/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic followup proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
