import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("[HealthCheck] Verifying Groq API configuration");
    
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      console.error("[HealthCheck] GROQ_API_KEY not found in environment");
      return NextResponse.json(
        { 
          status: "error", 
          message: "GROQ_API_KEY not configured",
          configured: false
        }, 
        { status: 500 }
      );
    }

    // Test the API key by making a simple request to Groq
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[HealthCheck] Groq API authentication failed:", errorText);
      return NextResponse.json(
        { 
          status: "error", 
          message: "Groq API authentication failed",
          details: errorText,
          configured: true,
          valid: false
        }, 
        { status: 401 }
      );
    }

    const models = await response.json();
    const whisperModels = models.data?.filter((m: any) => m.id.includes("whisper")) || [];
    
    console.log("[HealthCheck] Groq API is working, found whisper models:", whisperModels.map((m: any) => m.id));
    
    return NextResponse.json({
      status: "ok",
      message: "Groq API is configured and working",
      configured: true,
      valid: true,
      whisperModels: whisperModels.map((m: any) => m.id),
      totalModels: models.data?.length || 0
    });
  } catch (err) {
    console.error("[HealthCheck] Health check failed:", err);
    return NextResponse.json(
      { 
        status: "error", 
        message: "Health check failed",
        details: String(err)
      }, 
      { status: 500 }
    );
  }
}
