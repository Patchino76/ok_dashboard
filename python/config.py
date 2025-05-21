import os
from dotenv import load_dotenv
from typing import List

# Load environment variables from .env file
load_dotenv()

# Get environment mode
ENV = os.getenv("NODE_ENV", "development")

# Define configuration based on environment
if ENV == "production":
    HOST = "0.0.0.0"
    PORT = 8001
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://localhost:3000",
        "http://em-m-db4.ellatzite-med.com:3000",
        "http://em-m-db4.ellatzite-med.com:3001",
        "http://em-m-db4.ellatzite-med.com:8000",
        "http://em-m-db4.ellatzite-med.com:8001"
    ]
else:  # development
    HOST = "0.0.0.0"
    PORT = 8000
    CORS_ORIGINS = [
        "http://localhost:3000",
        "https://localhost:3000"
    ]
