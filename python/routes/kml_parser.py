"""
KML Boundary Parser API Route

Parses KML files to extract district boundaries and convert to GeoJSON format.
Handles both Polygon and MultiPolygon geometries.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
import defusedxml.ElementTree as ET
from xml.etree.ElementTree import Element  # For type hints only
import logging

router = APIRouter(prefix="/kml", tags=["KML Parser"])
logger = logging.getLogger(__name__)

# KML namespace
KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}


class GeometryCoordinates(BaseModel):
    """Coordinates for a geometry"""
    type: str = Field(..., description="Geometry type (Polygon or MultiPolygon)")
    coordinates: Union[List[List[List[float]]], List[List[List[List[float]]]]] = Field(
        ...,
        description="GeoJSON coordinates array"
    )


class DistrictFeature(BaseModel):
    """GeoJSON feature representing a district boundary"""
    type: str = Field(default="Feature", description="GeoJSON type")
    properties: Dict[str, Any] = Field(..., description="District properties (name, description, etc.)")
    geometry: GeometryCoordinates = Field(..., description="District geometry in GeoJSON format")


class KMLParseResponse(BaseModel):
    """Response model for KML parsing"""
    success: bool = Field(..., description="Whether parsing was successful")
    features: List[DistrictFeature] = Field(default_factory=list, description="List of district features")
    error: Optional[str] = Field(None, description="Error message if parsing failed")
    metadata: Optional[Dict[str, Any]] = Field(None, description="KML metadata (document name, etc.)")


def parse_coordinates(coord_string: str) -> List[List[float]]:
    """
    Parse KML coordinate string to list of [lng, lat] pairs

    KML format: "lng,lat,alt lng,lat,alt ..."
    GeoJSON format: [[lng, lat], [lng, lat], ...]

    Args:
        coord_string: Space-separated coordinate triplets

    Returns:
        List of [longitude, latitude] pairs

    Raises:
        ValueError: If coordinates are invalid
    """
    try:
        coordinates = []
        # Split by whitespace and filter empty strings
        coord_triplets = [c.strip() for c in coord_string.strip().split() if c.strip()]

        for triplet in coord_triplets:
            parts = triplet.split(',')
            if len(parts) < 2:
                logger.warning(f"Invalid coordinate triplet: {triplet}")
                continue

            # KML is lng,lat,alt - we only need lng,lat for GeoJSON
            lng = float(parts[0])
            lat = float(parts[1])
            coordinates.append([lng, lat])

        if not coordinates:
            raise ValueError("No valid coordinates found")

        return coordinates

    except (ValueError, IndexError) as e:
        logger.error(f"Error parsing coordinates: {str(e)}")
        raise ValueError(f"Invalid coordinate format: {str(e)}")


def parse_polygon(placemark: Element) -> Optional[GeometryCoordinates]:
    """
    Parse a Polygon or MultiPolygon from KML placemark

    Args:
        placemark: KML Placemark element

    Returns:
        GeometryCoordinates object or None if no valid geometry found
    """
    # Check for MultiGeometry (MultiPolygon)
    multi_geometry = placemark.find(".//kml:MultiGeometry", KML_NS)
    if multi_geometry is not None:
        # MultiPolygon: array of polygons
        polygons = []
        for polygon_elem in multi_geometry.findall(".//kml:Polygon", KML_NS):
            outer_boundary = polygon_elem.find(".//kml:outerBoundaryIs//kml:coordinates", KML_NS)
            if outer_boundary is not None and outer_boundary.text:
                try:
                    coords = parse_coordinates(outer_boundary.text)
                    # GeoJSON Polygon: [[[outer ring]]]
                    polygons.append([coords])
                except ValueError as e:
                    logger.warning(f"Skipping invalid polygon: {str(e)}")
                    continue

        if polygons:
            return GeometryCoordinates(
                type="MultiPolygon",
                coordinates=polygons
            )

    # Check for single Polygon
    polygon = placemark.find(".//kml:Polygon", KML_NS)
    if polygon is not None:
        outer_boundary = polygon.find(".//kml:outerBoundaryIs//kml:coordinates", KML_NS)
        if outer_boundary is not None and outer_boundary.text:
            try:
                coords = parse_coordinates(outer_boundary.text)
                # GeoJSON Polygon: [[[outer ring]]]
                return GeometryCoordinates(
                    type="Polygon",
                    coordinates=[coords]
                )
            except ValueError as e:
                logger.warning(f"Invalid polygon coordinates: {str(e)}")

    return None


def extract_properties(placemark: ET.Element) -> Dict[str, Any]:
    """
    Extract properties from KML placemark

    Args:
        placemark: KML Placemark element

    Returns:
        Dictionary of properties (name, description, extended data)
    """
    properties: Dict[str, Any] = {}

    # Extract name
    name_elem = placemark.find("kml:name", KML_NS)
    if name_elem is not None and name_elem.text:
        properties["name"] = name_elem.text.strip()

    # Extract description
    desc_elem = placemark.find("kml:description", KML_NS)
    if desc_elem is not None and desc_elem.text:
        properties["description"] = desc_elem.text.strip()

    # Extract ExtendedData
    extended_data = placemark.find("kml:ExtendedData", KML_NS)
    if extended_data is not None:
        for data_elem in extended_data.findall("kml:Data", KML_NS):
            name_attr = data_elem.get("name")
            value_elem = data_elem.find("kml:value", KML_NS)
            if name_attr and value_elem is not None and value_elem.text:
                properties[name_attr] = value_elem.text.strip()

    return properties


@router.post("/parse", response_model=KMLParseResponse)
async def parse_kml(file: UploadFile = File(...)) -> KMLParseResponse:
    """
    Parse KML file to extract district boundaries

    Converts KML format to GeoJSON features with properties.
    Handles both Polygon and MultiPolygon geometries.

    Args:
        file: Uploaded KML file

    Returns:
        KMLParseResponse with list of district features

    Raises:
        HTTPException: If file is invalid or parsing fails
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.kml'):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a KML file."
        )

    try:
        # Read file content
        content = await file.read()

        # Decode to string (KML is XML text)
        try:
            kml_string = content.decode('utf-8')
        except UnicodeDecodeError:
            # Try latin-1 as fallback
            kml_string = content.decode('latin-1')

        # Parse XML
        try:
            root = ET.fromstring(kml_string)
        except ET.ParseError as e:
            logger.error(f"XML parse error: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid KML file: {str(e)}"
            )

        # Extract document metadata
        metadata = {}
        document = root.find(".//kml:Document", KML_NS)
        if document is not None:
            doc_name = document.find("kml:name", KML_NS)
            if doc_name is not None and doc_name.text:
                metadata["document_name"] = doc_name.text.strip()

            doc_desc = document.find("kml:description", KML_NS)
            if doc_desc is not None and doc_desc.text:
                metadata["document_description"] = doc_desc.text.strip()

        # Extract all placemarks
        features: List[DistrictFeature] = []
        placemarks = root.findall(".//kml:Placemark", KML_NS)

        if not placemarks:
            logger.warning("No placemarks found in KML file")
            return KMLParseResponse(
                success=False,
                features=[],
                error="No placemarks found in KML file",
                metadata=metadata if metadata else None
            )

        # Parse each placemark
        for placemark in placemarks:
            # Extract geometry
            geometry = parse_polygon(placemark)
            if geometry is None:
                logger.warning("Placemark has no valid geometry, skipping")
                continue

            # Extract properties
            properties = extract_properties(placemark)

            # Create feature
            feature = DistrictFeature(
                type="Feature",
                properties=properties,
                geometry=geometry
            )
            features.append(feature)

        if not features:
            return KMLParseResponse(
                success=False,
                features=[],
                error="No valid district boundaries found in KML file",
                metadata=metadata if metadata else None
            )

        logger.info(f"Successfully parsed KML file: {file.filename} ({len(features)} features)")

        return KMLParseResponse(
            success=True,
            features=features,
            error=None,
            metadata=metadata if metadata else None
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise

    except Exception as e:
        logger.error(f"Unexpected error parsing KML: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while parsing KML file: {str(e)}"
        )
