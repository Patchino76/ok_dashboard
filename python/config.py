import os
from dotenv import load_dotenv
from typing import List

# Load environment variables from .env file
load_dotenv(override=True)

# Get environment mode
ENV = os.getenv("NODE_ENV", "development")

# Define configuration based on environment
if ENV == "production":
    HOST = "0.0.0.0"
    PORT = int(os.getenv("PORT", 8001))
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://localhost:3000",
        "https://profimine.ellatzite-med.com"
    ]
else:  # development
    HOST = "127.0.0.1"
    PORT = int(os.getenv("PORT", 8000))
    CORS_ORIGINS = [
        "http://localhost:3000",
        "https://localhost:3000"
    ]
