FROM python:3.11-slim

# Install curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file
COPY python/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python source code
COPY python ./python

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 8000

# Health check using curl
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["python", "-m", "uvicorn", "python.main:app", "--host", "0.0.0.0", "--port", "8000"]
