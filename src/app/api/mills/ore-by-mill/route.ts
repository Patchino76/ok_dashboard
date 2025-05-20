import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mill = searchParams.get("mill");

  if (!mill) {
    return NextResponse.json(
      { error: "Mill parameter is required" },
      { status: 400 }
    );
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error('NEXT_PUBLIC_API_URL is not defined');
    }
    
    const response = await fetch(`${apiUrl}/api/mills/ore-by-mill?mill=${mill}`);
    
    if (!response.ok) {
      throw new Error(`Backend returned status: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching mill data:", error);
    return NextResponse.json(
      { error: "Failed to fetch mill data" },
      { status: 500 }
    );
  }
}
