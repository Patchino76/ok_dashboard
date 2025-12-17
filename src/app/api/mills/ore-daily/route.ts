import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is not defined");
    }

    const response = await fetch(
      `${apiUrl}/api/mills/ore-daily?start_date=${start_date}&end_date=${end_date}`
    );

    const raw = await response.text();
    let data: any = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // Keep raw text
    }

    return NextResponse.json(
      response.ok
        ? data
        : { error: "Backend error", status: response.status, data },
      { status: response.status }
    );
  } catch (error) {
    console.error("Error fetching mills ore daily:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch mills ore daily",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
