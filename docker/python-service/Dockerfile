FROM python:3.11-slim

# Install curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user and group for security (before copying/installing deps)
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Copy requirements file as non-root
USER appuser
COPY --chown=appuser:appuser python/requirements.txt ./

# Install Python dependencies (user scope)
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy Python source code as non-root
COPY --chown=appuser:appuser python ./python

# Create logs directory
RUN mkdir -p /app/logs

# Ensure container runs as non-root user
# (USER already set earlier for build steps)

# Expose port
EXPOSE 8000

# Health check using curl
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["python", "-m", "uvicorn", "python.main:app", "--host", "0.0.0.0", "--port", "8000"]
