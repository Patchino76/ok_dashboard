import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${API_URL}/api/v1/agentic/status/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Agentic status proxy error:", msg);
    return NextResponse.json({ error: "Proxy error", details: msg }, { status: 500 });
  }
}
