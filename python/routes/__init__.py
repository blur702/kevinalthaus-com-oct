"""
Routes package for Python FastAPI service

Contains all API route handlers for the SSDD Validator plugin.
"""

# Import routers for easy access
from .usps import router as usps_router
from .geocode import router as geocode_router
from .kml_parser import router as kml_parser_router
from .house_api import router as house_api_router

__all__ = [
    "usps_router",
    "geocode_router",
    "kml_parser_router",
    "house_api_router",
]
