from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import os
import time
import asyncio
from functools import lru_cache
from typing import Dict, Any

app = FastAPI(
    title="Kevin Althaus Python Service",
    docs_url="/docs" if os.getenv("PYTHON_ENV", "development") == "development" else None,
    redoc_url="/redoc" if os.getenv("PYTHON_ENV", "development") == "development" else None
)

# Performance middleware - compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Response cache for GET requests
response_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300  # 5 minutes
MAX_CACHE_SIZE = 1000

def generate_cache_key(request: Request) -> str:
    """Generate cache key from request"""
    return f"{request.method}:{request.url.path}:{str(request.query_params)}"

def is_cache_valid(cache_entry: Dict[str, Any]) -> bool:
    """Check if cache entry is still valid"""
    return time.time() - cache_entry["timestamp"] < CACHE_TTL

@lru_cache(maxsize=100)
def get_environment_config() -> Dict[str, Any]:
    """Cached environment configuration"""
    environment = os.getenv("PYTHON_ENV", "development")
    return {
        "environment": environment,
        "is_production": environment == "production",
        "debug": environment == "development"
    }

# Parse CORS_ORIGIN from environment variable (aligned with Node services)
cors_origin_env = os.getenv("CORS_ORIGIN", "")
if cors_origin_env and cors_origin_env != "*":
    # Parse comma-separated origins and trim whitespace
    allowed_origins = [origin.strip() for origin in cors_origin_env.split(",") if origin.strip()]
    allow_credentials = os.getenv("CORS_CREDENTIALS", "true").lower() == "true"
elif cors_origin_env == "*":
    # Wildcard origins - disable credentials for security
    allowed_origins = ["*"]
    allow_credentials = False
else:
    # Default safe origins based on environment
    config = get_environment_config()
    if config["is_production"]:
        # Default production origins for kevinalthaus.com
        allowed_origins = ["https://kevinalthaus.com", "https://www.kevinalthaus.com"]
        allow_credentials = True
    else:
        # Development origins (aligned with Node services)
        allowed_origins = ["http://localhost:3000", "http://localhost:3002", "http://localhost:3003"]
        allow_credentials = True

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker healthcheck"""
    return {"status": "healthy", "service": "python-service"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Kevin Althaus Python Service",
        "version": "1.0.0",
        "environment": os.getenv("PYTHON_ENV", "development")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
