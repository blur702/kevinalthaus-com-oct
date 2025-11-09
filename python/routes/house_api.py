"""
Congressional Members API Route

Provides access to US House of Representatives member data from Congress.gov API.
May require CONGRESS_API_KEY environment variable.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import httpx
import os
import logging

router = APIRouter(prefix="/house", tags=["Congressional API"])
logger = logging.getLogger(__name__)


class CongressionalMember(BaseModel):
    """Model for a Congressional member"""
    bioguide_id: str = Field(..., description="Bioguide ID")
    name: str = Field(..., description="Full name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    state: str = Field(..., description="Two-letter state code")
    district: Optional[int] = Field(None, description="Congressional district number")
    party: str = Field(..., description="Political party")
    chamber: str = Field(..., description="Chamber (House or Senate)")
    url: Optional[str] = Field(None, description="Member URL")
    image_url: Optional[str] = Field(None, description="Official portrait URL")


class HouseMembersResponse(BaseModel):
    """Response model for House members query"""
    success: bool = Field(..., description="Whether query was successful")
    members: List[CongressionalMember] = Field(default_factory=list, description="List of House members")
    total_count: int = Field(..., description="Total number of members returned")
    error: Optional[str] = Field(None, description="Error message if query failed")


def parse_member_data(member_data: Dict[str, Any]) -> Optional[CongressionalMember]:
    """
    Parse member data from Congress.gov API response

    Args:
        member_data: Raw member data dictionary

    Returns:
        CongressionalMember object or None if data is invalid
    """
    try:
        # Extract basic info
        bioguide_id = member_data.get("bioguideId")
        if not bioguide_id:
            logger.warning("Member missing bioguideId, skipping")
            return None

        # Extract name
        name = member_data.get("name", "")

        # Extract state
        state = member_data.get("state", "")
        if not state:
            logger.warning(f"Member {bioguide_id} missing state, skipping")
            return None

        # Extract district (may be None for Senators or at-large districts)
        district = member_data.get("district")
        if district is not None:
            try:
                district = int(district)
            except (ValueError, TypeError):
                logger.warning(f"Invalid district value for {bioguide_id}: {district}")
                district = None

        # Extract party
        party_name = member_data.get("partyName", "")
        party = "Unknown"
        if "Democrat" in party_name:
            party = "Democrat"
        elif "Republican" in party_name:
            party = "Republican"
        elif "Independent" in party_name:
            party = "Independent"
        elif party_name:
            party = party_name

        # Determine chamber - use terms array if available
        chamber = "Unknown"
        terms = member_data.get("terms", {})
        if isinstance(terms, dict):
            items = terms.get("item", [])
            if items and isinstance(items, list) and len(items) > 0:
                # Get most recent term by startYear (descending)
                try:
                    sorted_items = sorted(items, key=lambda it: int(it.get('startYear', 0) or 0), reverse=True)
                    latest_term = sorted_items[0]
                except Exception:
                    latest_term = items[0]
                chamber = latest_term.get("chamber", "Unknown")

        # Build URL to member page
        url = None
        if bioguide_id:
            url = f"https://www.congress.gov/member/{bioguide_id}"

        # Image URL (Congress.gov API pattern)
        image_url = None
        if bioguide_id:
            image_url = f"https://www.congress.gov/img/member/{bioguide_id.lower()}_200.jpg"

        return CongressionalMember(
            bioguide_id=bioguide_id,
            name=name,
            first_name=member_data.get("firstName"),
            last_name=member_data.get("lastName"),
            state=state,
            district=district,
            party=party,
            chamber=chamber,
            url=url,
            image_url=image_url
        )

    except Exception as e:
        logger.error(f"Error parsing member data: {str(e)}")
        return None


@router.get("/members", response_model=HouseMembersResponse)
async def get_house_members(
    state: Optional[str] = Query(None, description="Filter by two-letter state code"),
    current_only: bool = Query(True, description="Only return current members")
) -> HouseMembersResponse:
    """
    Get list of US House of Representatives members

    Fetches data from Congress.gov API v3.
    Filters to House members only (excludes Senators).

    Args:
        state: Optional state filter (two-letter code)
        current_only: Whether to only return current members

    Returns:
        HouseMembersResponse with list of House members

    Raises:
        HTTPException: If Congress API is unavailable
    """
    try:
        # Build API URL
        base_url = "https://api.congress.gov/v3/member"

        # Query parameters
        params: Dict[str, Any] = {
            "limit": 250,  # Get up to 250 members per request
            "format": "json"
        }

        if current_only:
            params["currentMember"] = "true"

        # Add API key if available
        api_key = os.getenv("CONGRESS_API_KEY")
        if api_key:
            params["api_key"] = api_key

        # Make request
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(base_url, params=params)

            # Check if we need API key
            if response.status_code == 403:
                logger.error("Congress API returned 403 - API key may be required")
                raise HTTPException(
                    status_code=500,
                    detail="Congress API requires authentication. Please set CONGRESS_API_KEY environment variable."
                )

            response.raise_for_status()

            # Parse response
            data = response.json()

            # Extract members array
            members_data = data.get("members", [])
            if not members_data:
                logger.warning("No members found in API response")
                return HouseMembersResponse(
                    success=True,
                    members=[],
                    total_count=0,
                    error=None
                )

            # Parse members and filter to House only
            members: List[CongressionalMember] = []
            for member_data in members_data:
                parsed = parse_member_data(member_data)
                if parsed is None:
                    continue

                # Filter to House members only
                if parsed.chamber.lower() != "house":
                    continue

                # Apply state filter if specified
                if state and parsed.state.upper() != state.upper():
                    continue

                members.append(parsed)

            logger.info(f"Successfully fetched {len(members)} House members")

            return HouseMembersResponse(
                success=True,
                members=members,
                total_count=len(members),
                error=None
            )

    except httpx.HTTPStatusError as e:
        logger.error(f"Congress API HTTP error: {e.response.status_code}")
        raise HTTPException(
            status_code=502,
            detail=f"Congress API returned error: {e.response.status_code}"
        )

    except httpx.RequestError as e:
        logger.error(f"Congress API request error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Congress API. Please try again later."
        )

    except Exception as e:
        logger.error(f"Unexpected error fetching House members: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while fetching House members."
        )
