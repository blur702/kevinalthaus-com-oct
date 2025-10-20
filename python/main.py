from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Kevin Althaus Python Service")

# Parse ALLOWED_ORIGINS from environment variable
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env and allowed_origins_env != "*":
    # Parse comma-separated origins and trim whitespace
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
    allow_credentials = True
elif allowed_origins_env == "*":
    # Wildcard origins - disable credentials for security
    allowed_origins = ["*"]
    allow_credentials = False
else:
    # Default safe origins based on environment
    environment = os.getenv("PYTHON_ENV", "development")
    if environment == "production":
        # Default production origins for kevinalthaus.com
        allowed_origins = ["https://kevinalthaus.com", "https://www.kevinalthaus.com"]
        allow_credentials = True
    else:
        # Development origins
        allowed_origins = ["http://localhost:3000", "http://localhost:3001"]
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
