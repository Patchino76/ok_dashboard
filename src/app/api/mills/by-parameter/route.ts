import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parameter = searchParams.get("parameter");
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  if (!parameter) {
    return NextResponse.json(
      { error: "Parameter is required" },
      { status: 400 }
    );
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error('NEXT_PUBLIC_API_URL is not defined');
    }
    
    const response = await fetch(
      `${apiUrl}/api/mills/by-parameter?parameter=${parameter}&date=${date}`
    );
    
    if (!response.ok) {
      throw new Error(`Backend returned status: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching mills by parameter:", error);
    return NextResponse.json(
      { error: "Failed to fetch mills by parameter" },
      { status: 500 }
    );
  }
}
