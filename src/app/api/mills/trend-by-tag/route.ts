import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mill = searchParams.get("mill");
  const tag = searchParams.get("tag");
  const trendPoints = parseInt(searchParams.get("trendPoints") || "500", 10);
  const hours = searchParams.get("hours");

  if (!mill || !tag) {
    return NextResponse.json(
      { error: "Mill and tag parameters are required" },
      { status: 400 }
    );
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is not defined");
    }

    // Build URL with optional hours parameter
    let url = `${apiUrl}/api/mills/trend-by-tag?mill=${mill}&tag=${tag}&trendPoints=${trendPoints}`;
    if (hours) {
      url += `&hours=${hours}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Backend returned status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching mill trend data:", error);
    return NextResponse.json(
      { error: "Failed to fetch mill trend data" },
      { status: 500 }
    );
  }
}
