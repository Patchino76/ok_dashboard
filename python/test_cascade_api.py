#!/usr/bin/env python3
"""
Test script to verify cascade API endpoints are working
"""
import uvicorn
import sys
import os
from pathlib import Path

# Add current directory to path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Import the FastAPI app
from api import app

if __name__ == "__main__":
    print("Starting test server with cascade endpoints...")
    print("Server will be available at: http://localhost:8000")
    print("API docs at: http://localhost:8000/docs")
    print("Cascade endpoints at: http://localhost:8000/api/v1/cascade/")
    
    # Start the server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
