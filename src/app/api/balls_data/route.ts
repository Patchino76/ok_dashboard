import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    let apiUrl;
    if (process.env.NODE_ENV === "production") {
      apiUrl = "http://127.0.0.1:8001";
    } else {
      apiUrl = process.env.NEXT_PUBLIC_API_URL;
    }

    if (!apiUrl) {
      return NextResponse.json(
        { error: "Server configuration error: API URL not defined" },
        { status: 500 }
      );
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.toString();
    const backendUrl = `${apiUrl}/api/balls_data${query ? `?${query}` : ""}`;

    const response = await fetch(backendUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let details: unknown = "No error details";
      try {
        details = await response.json();
      } catch {
        details = await response.text().catch(() => "No error details");
      }
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch balls data", details: errorMessage },
      { status: 500 }
    );
  }
}
