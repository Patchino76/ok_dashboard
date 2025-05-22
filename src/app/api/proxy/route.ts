import { NextRequest, NextResponse } from "next/server";

/**
 * Universal proxy handler that forwards all requests to the backend API
 */
export async function GET(request: NextRequest) {
  try {
    // Get the API URL from environment
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Extract the path and query parameters from the request URL
    const { pathname, searchParams } = request.nextUrl;
    const path = pathname.replace('/api/proxy', '');
    
    // Preserve all query parameters
    const queryString = Array.from(searchParams.entries())
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    // Construct the backend URL
    const backendUrl = `${apiUrl}${path}${queryString ? `?${queryString}` : ''}`;
    console.log(`Proxying request to: ${backendUrl}`);
    
    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });
    
    // Check if the response can be parsed as JSON
    let data;
    try {
      data = await response.json();
    } catch (e) {
      // If response is not JSON, return the text content
      const textContent = await response.text();
      console.error(`Invalid JSON response from ${backendUrl}:`, textContent);
      return NextResponse.json(
        { error: "Invalid JSON response", details: textContent },
        { status: 500 }
      );
    }
    
    // Even for error responses, if we got a valid JSON, return it with the correct status
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Proxy error:", errorMessage);
    return NextResponse.json(
      { error: "Proxy error", details: errorMessage },
      { status: 500 }
    );
  }
}
