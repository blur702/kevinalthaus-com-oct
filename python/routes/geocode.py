"""
Geocoding API Route using Nominatim (OpenStreetMap)

Provides geocoding services with rate limiting to comply with Nominatim usage policy.
Rate limit: 1 request per second
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import httpx
import asyncio
import logging
from datetime import datetime
import os

# Optional Redis-based rate limiting (distributed)
try:
    import redis.asyncio as aioredis  # type: ignore
except Exception:  # pragma: no cover - best-effort import
    aioredis = None  # type: ignore

router = APIRouter(prefix="/geocode", tags=["Geocoding"])
logger = logging.getLogger(__name__)

# Rate limiting: Nominatim requires 1 request per second
_last_request_time: Optional[float] = None
_rate_limit_lock = asyncio.Lock()
_redis = None


async def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    if aioredis is None:
        return None
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        _redis = aioredis.from_url(redis_url, decode_responses=True)
        # Simple ping to verify connectivity
        await _redis.ping()
        return _redis
    except Exception:
        _redis = None
        return None


class GeocodeRequest(BaseModel):
    """Request model for geocoding"""
    address: str = Field(..., description="Full address to geocode", min_length=1)


class GeocodeResult(BaseModel):
    """Individual geocoding result"""
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")
    display_name: str = Field(..., description="Formatted display name from Nominatim")
    place_id: Optional[str] = Field(None, description="Nominatim place ID")
    osm_type: Optional[str] = Field(None, description="OpenStreetMap type")
    osm_id: Optional[str] = Field(None, description="OpenStreetMap ID")
    importance: Optional[float] = Field(None, description="Result importance score")


class GeocodeResponse(BaseModel):
    """Response model for geocoding"""
    success: bool = Field(..., description="Whether geocoding was successful")
    results: List[GeocodeResult] = Field(default_factory=list, description="List of geocoding results")
    error: Optional[str] = Field(None, description="Error message if geocoding failed")
    query: str = Field(..., description="Original query address")


async def enforce_rate_limit() -> None:
    """
    Enforce Nominatim rate limit of 1 request per second

    Uses a lock to ensure only one request is made at a time,
    and adds delay if needed to maintain 1 req/sec limit.
    """
    # Allow tests to bypass rate limit
    if os.getenv("E2E_TESTING") == "true":
        return

    # Try Redis-based distributed limiter first
    r = await _get_redis()
    if r is not None:
        # Use a simple distributed lock with 1s TTL
        key = "rate:geocode:lock"
        while True:
            locked = await r.set(key, "1", ex=1, nx=True)
            if locked:
                return
            # Wait for key to expire
            ttl = await r.ttl(key)
            wait_time = 1.0 if ttl is None or ttl < 0 else max(0.05, ttl)
            logger.debug(f"Redis rate limit in effect; waiting {wait_time:.2f}s")
            await asyncio.sleep(min(wait_time, 1.0))

    # Fallback to process-local limiter
    global _last_request_time
    async with _rate_limit_lock:
        if _last_request_time is not None:
            elapsed = datetime.now().timestamp() - _last_request_time
            if elapsed < 1.0:
                await asyncio.sleep(1.0 - elapsed)
        _last_request_time = datetime.now().timestamp()


@router.post("", response_model=GeocodeResponse)
async def geocode_address(request: GeocodeRequest) -> GeocodeResponse:
    """
    Geocode an address using Nominatim (OpenStreetMap)

    Returns latitude and longitude coordinates for the given address.
    Rate limited to 1 request per second per Nominatim usage policy.

    Args:
        request: Geocode request with address string

    Returns:
        GeocodeResponse with coordinates or error

    Raises:
        HTTPException: If Nominatim API is unavailable
    """
    try:
        # Enforce rate limit
        await enforce_rate_limit()

        # Build Nominatim API request
        nominatim_url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": request.address,
            "format": "json",
            "addressdetails": 1,
            "limit": 5  # Return up to 5 results
        }

        headers = {
            # Nominatim requires a User-Agent header
            "User-Agent": "SSddValidator/1.0 (contact@kevinalthaus.com)"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(nominatim_url, params=params, headers=headers)
            response.raise_for_status()

            # Parse JSON response
            data = response.json()

            if not data or len(data) == 0:
                logger.info(f"No results found for address: {request.address}")
                return GeocodeResponse(
                    success=False,
                    results=[],
                    error="No results found for the given address",
                    query=request.address
                )

            # Parse results
            results = []
            for item in data:
                lat_val = item.get("lat")
                lon_val = item.get("lon")
                if lat_val is None or lon_val is None:
                    logger.debug("Skipping result without coordinates")
                    continue
                try:
                    lat_f = float(lat_val)
                    lon_f = float(lon_val)
                except (TypeError, ValueError):
                    logger.debug("Skipping result with invalid coordinate types")
                    continue
                result = GeocodeResult(
                    lat=lat_f,
                    lng=lon_f,
                    display_name=item.get("display_name", ""),
                    place_id=item.get("place_id"),
                    osm_type=item.get("osm_type"),
                    osm_id=str(item.get("osm_id")) if item.get("osm_id") else None,
                    importance=float(item.get("importance")) if item.get("importance") else None
                )
                results.append(result)

            logger.info(f"Successfully geocoded address: {request.address} ({len(results)} results)")

            return GeocodeResponse(
                success=True,
                results=results,
                error=None,
                query=request.address
            )

    except httpx.HTTPStatusError as e:
        logger.error(f"Nominatim API HTTP error: {e.response.status_code}")
        raise HTTPException(
            status_code=502,
            detail=f"Nominatim API returned error: {e.response.status_code}"
        ) from e

    except httpx.RequestError as e:
        logger.error(f"Nominatim API request error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Nominatim API. Please try again later."
        ) from e

    except ValueError as e:
        logger.error(f"Error parsing Nominatim response: {str(e)}")
        return GeocodeResponse(
            success=False,
            results=[],
            error="Invalid response from geocoding service",
            query=request.address
        )

    except Exception as e:
        logger.error(f"Unexpected error in geocoding: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during geocoding."
        ) from e
