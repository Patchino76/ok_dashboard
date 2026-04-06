import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/v1/agentic/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic analyze proxy error:", msg);
    return NextResponse.json(
      { error: "Proxy error", details: msg },
      { status: 500 },
    );
  }
}
