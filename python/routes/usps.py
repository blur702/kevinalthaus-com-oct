"""
USPS Address Validation API Route

Provides address validation using the USPS Web Tools API.
Requires USPS_API_USER_ID environment variable.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os
import defusedxml.ElementTree as ET
from xml.sax.saxutils import escape as xml_escape
import httpx
import logging

router = APIRouter(prefix="/usps", tags=["USPS"])
logger = logging.getLogger(__name__)


class AddressRequest(BaseModel):
    """Request model for address validation"""
    street1: str = Field(..., description="Primary street address")
    street2: Optional[str] = Field(None, description="Secondary address (apt, suite, etc.)")
    city: str = Field(..., description="City name")
    state: str = Field(..., min_length=2, max_length=2, description="Two-letter state code")
    zip: str = Field(..., description="ZIP code (5 or 9 digits)")


class AddressValidationResponse(BaseModel):
    """Response model for address validation"""
    success: bool = Field(..., description="Whether validation was successful")
    standardized_address: Optional[dict] = Field(None, description="Standardized address from USPS")
    error: Optional[str] = Field(None, description="Error message if validation failed")
    raw_response: Optional[dict] = Field(None, description="Raw USPS response for debugging")


def build_usps_xml(address: AddressRequest, user_id: str) -> str:
    """
    Build USPS API XML request with proper escaping to prevent XML injection

    Args:
        address: Address to validate
        user_id: USPS API user ID

    Returns:
        XML string for USPS API request
    """
    # Escape all user inputs to prevent XML injection attacks
    street1_escaped = xml_escape(address.street1)
    street2_escaped = xml_escape(address.street2 or "")
    city_escaped = xml_escape(address.city)
    state_escaped = xml_escape(address.state.upper())
    zip5_escaped = xml_escape(address.zip[:5])
    zip4_escaped = xml_escape(address.zip[5:] if len(address.zip) > 5 else "")
    user_id_escaped = xml_escape(user_id)

    xml_parts = [
        f'<AddressValidateRequest USERID="{user_id_escaped}">',
        '  <Revision>1</Revision>',
        '  <Address ID="0">',
        f'    <Address1>{street2_escaped}</Address1>',
        f'    <Address2>{street1_escaped}</Address2>',
        f'    <City>{city_escaped}</City>',
        f'    <State>{state_escaped}</State>',
        f'    <Zip5>{zip5_escaped}</Zip5>',
        f'    <Zip4>{zip4_escaped}</Zip4>',
        '  </Address>',
        '</AddressValidateRequest>'
    ]
    return ''.join(xml_parts)


def parse_usps_response(xml_string: str) -> dict:
    """
    Parse USPS XML response

    Args:
        xml_string: XML response from USPS API

    Returns:
        Parsed response dictionary

    Raises:
        ValueError: If response contains error
    """
    try:
        root = ET.fromstring(xml_string)

        # Check for error response
        error = root.find('.//Error')
        if error is not None:
            error_number = error.find('Number')
            error_desc = error.find('Description')
            error_msg = f"USPS Error {error_number.text if error_number is not None else 'Unknown'}: "
            error_msg += error_desc.text if error_desc is not None else "Unknown error"
            raise ValueError(error_msg)

        # Parse successful response
        address_elem = root.find('.//Address')
        if address_elem is None:
            raise ValueError("No address found in USPS response")

        # Extract address components
        result = {}
        for field in ['Address1', 'Address2', 'City', 'State', 'Zip5', 'Zip4']:
            elem = address_elem.find(field)
            if elem is not None and elem.text:
                result[field.lower()] = elem.text

        # Standardize field names
        standardized = {
            'street1': result.get('address2', ''),
            'street2': result.get('address1', ''),
            'city': result.get('city', ''),
            'state': result.get('state', ''),
            'zip': result.get('zip5', ''),
            'zip4': result.get('zip4', '')
        }

        # Combine ZIP+4 if available
        if standardized['zip4']:
            standardized['zip'] = f"{standardized['zip']}-{standardized['zip4']}"

        return standardized

    except ET.ParseError as e:
        logger.error(f"XML parse error: {e}")
        raise ValueError(f"Invalid XML response from USPS: {str(e)}")


@router.post("/validate", response_model=AddressValidationResponse)
async def validate_address(address: AddressRequest) -> AddressValidationResponse:
    """
    Validate and standardize a US address using USPS Web Tools API

    Args:
        address: Address to validate

    Returns:
        AddressValidationResponse with standardized address or error

    Raises:
        HTTPException: If USPS API is unavailable or configuration is missing
    """
    # Check for USPS API user ID
    usps_user_id = os.getenv("USPS_API_USER_ID")
    if not usps_user_id:
        logger.error("USPS_API_USER_ID environment variable not set")
        raise HTTPException(
            status_code=500,
            detail="USPS API is not configured. Please set USPS_API_USER_ID environment variable."
        )

    try:
        # Build XML request
        xml_request = build_usps_xml(address, usps_user_id)

        # Call USPS API
        usps_url = "https://secure.shippingapis.com/ShippingAPI.dll"
        params = {
            "API": "Verify",
            "XML": xml_request
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(usps_url, params=params)
            response.raise_for_status()

            # Parse response
            standardized = parse_usps_response(response.text)

            logger.info(f"Successfully validated address: {address.city}, {address.state}")

            return AddressValidationResponse(
                success=True,
                standardized_address=standardized,
                error=None,
                raw_response={"xml": response.text} if os.getenv("PYTHON_ENV") == "development" else None
            )

    except ValueError as e:
        # USPS validation error (address not found, invalid, etc.)
        logger.warning(f"USPS validation error: {str(e)}")
        return AddressValidationResponse(
            success=False,
            standardized_address=None,
            error=str(e),
            raw_response=None
        )

    except httpx.HTTPStatusError as e:
        logger.error(f"USPS API HTTP error: {e.response.status_code}")
        raise HTTPException(
            status_code=502,
            detail=f"USPS API returned error: {e.response.status_code}"
        )

    except httpx.RequestError as e:
        logger.error(f"USPS API request error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to USPS API. Please try again later."
        )

    except Exception as e:
        logger.error(f"Unexpected error in USPS validation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during address validation."
        )
