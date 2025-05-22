import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  // Simply use the id directly from the function parameters
  // but avoid destructuring or accessing properties directly
  const tagId = String(params?.id || "");
  const searchParams = request.nextUrl.searchParams;
  const hours = searchParams.get("hours") || "8";

  if (!tagId) {
    return NextResponse.json(
      { error: "Tag ID is required" },
      { status: 400 }
    );
  }

  try {
    // In production, use a direct localhost connection to the API
    // This assumes the FastAPI server is running on the same machine
    let apiUrl;
    if (process.env.NODE_ENV === 'production') {
      apiUrl = 'http://127.0.0.1:8001';
      console.log('Production mode: Using direct localhost connection to API');
    } else {
      // In development, use the environment variable
      apiUrl = process.env.NEXT_PUBLIC_API_URL;
    }
    
    if (!apiUrl) {
      console.error('API URL environment variable is missing');
      return NextResponse.json(
        { error: "Server configuration error: API URL not defined" },
        { status: 500 }
      );
    }
    
    const backendUrl = `${apiUrl}/api/tag-trend/${tagId}?hours=${hours}`;
    console.log(`Connecting to backend: ${backendUrl}`);
    
    const response = await fetch(backendUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`Backend error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error fetching tag trend data:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch tag trend data", details: errorMessage },
      { status: 500 }
    );
  }
}
