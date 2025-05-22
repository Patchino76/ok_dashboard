import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tagIds = searchParams.getAll("tag_ids");

  if (!tagIds || tagIds.length === 0) {
    return NextResponse.json(
      { error: "At least one tag_ids parameter is required" },
      { status: 400 }
    );
  }

  try {
    // In production, use a direct localhost connection to the API
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
    
    const queryParams = tagIds.map(id => `tag_ids=${id}`).join('&');
    const backendUrl = `${apiUrl}/api/tag-values?${queryParams}`;
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
    console.error("Error fetching tag values:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch tag values", details: errorMessage },
      { status: 500 }
    );
  }
}
