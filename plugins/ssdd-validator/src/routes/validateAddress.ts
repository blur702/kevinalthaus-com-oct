/**
 * Address validation handler
 * Validates address via USPS, geocodes it, and finds congressional district
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext, stripAllHTML } from '@monorepo/shared';
import type { HttpResponse } from '@monorepo/shared';
import type { Geometry } from 'geojson';
import { parseCentroid } from '../utils/postgis';
import type {
  ValidateAddressRequest,
  ValidateAddressResponse,
  USPSValidationResponse,
  GeocodeResponse,
  DistrictQueryResult,
  MemberQueryResult,
  District,
  Representative,
  Address,
} from '../types';

/**
 * Validate address handler
 */
export function validateAddressHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db, services } = context;
    const pool = db as Pool;

    try {
      // Extract and sanitize input
      const { street1, street2, city, state, zip } = req.body as ValidateAddressRequest;

      // Validate required fields
      if (!street1 || !city || !state || !zip) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: street1, city, state, zip',
        } as ValidateAddressResponse);
        return;
      }

      // Sanitize inputs
      const sanitizedStreet1 = stripAllHTML(street1.trim());
      const sanitizedStreet2 = street2 ? stripAllHTML(street2.trim()) : undefined;
      const sanitizedCity = stripAllHTML(city.trim());
      const sanitizedState = stripAllHTML(state.trim().toUpperCase());
      const sanitizedZip = stripAllHTML(zip.trim());

      // Validate state format (2 letters)
      if (!/^[A-Z]{2}$/.test(sanitizedState)) {
        res.status(400).json({
          success: false,
          error: 'Invalid state format. Must be 2-letter state code (e.g., CA, NY)',
        } as ValidateAddressResponse);
        return;
      }

      // Validate ZIP format
      // eslint-disable-next-line security/detect-unsafe-regex
      if (!/^\d{5}(-\d{4})?$/.test(sanitizedZip)) {
        res.status(400).json({
          success: false,
          error: 'Invalid ZIP code format. Must be 5 digits or 5+4 format',
        } as ValidateAddressResponse);
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        } as ValidateAddressResponse);
        return;
      }

      logger.info('Validating address via USPS', {
        userId,
        city: sanitizedCity,
        state: sanitizedState,
        zip: sanitizedZip,
      });

      // Step 1: Validate address with USPS via Python service
      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://python-service:8000';
      const uspsResponse: HttpResponse<USPSValidationResponse> = await services.http.post<USPSValidationResponse>(
        `${pythonServiceUrl}/usps/validate`,
        {
          street1: sanitizedStreet1,
          street2: sanitizedStreet2,
          city: sanitizedCity,
          state: sanitizedState,
          zip: sanitizedZip,
        },
        { timeout: 10000 }
      );

      const uspsData: USPSValidationResponse = uspsResponse.data;

      if (!uspsData.success || !uspsData.validated) {
        logger.warn('USPS validation failed', { uspsData });
        res.status(400).json({
          success: false,
          error: uspsData.error || 'Address validation failed',
          alternativeAddresses: uspsData.alternatives,
        } as ValidateAddressResponse);
        return;
      }

      const validated = uspsData.validated;

      // Step 2: Geocode the validated address
      const geocodeResponse: HttpResponse<GeocodeResponse> = await services.http.post<GeocodeResponse>(
        `${pythonServiceUrl}/geocode`,
        {
          street1: validated.street1,
          street2: validated.street2,
          city: validated.city,
          state: validated.state,
          zip: validated.zip,
        },
        { timeout: 10000 }
      );

      const geocodeData: GeocodeResponse = geocodeResponse.data;

      if (!geocodeData.success || !geocodeData.coordinates) {
        logger.error(`Geocoding failed: ${geocodeData.error || 'Unknown error'}`);
        res.status(500).json({
          success: false,
          error: geocodeData.error || 'Geocoding failed',
        } as ValidateAddressResponse);
        return;
      }

      const { lat, lng } = geocodeData.coordinates;

      logger.info('Address geocoded successfully', { lat, lng });

      // Step 3: Find congressional district using PostGIS
      const districtQuery = `
        SELECT
          id,
          ssdd,
          state,
          district_number,
          name,
          ST_AsGeoJSON(boundary) as boundary,
          area_sq_km,
          ST_AsText(centroid) as centroid,
          metadata
        FROM plugin_ssdd_validator.districts
        WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
        LIMIT 1
      `;

      let district: District | undefined;
      interface InsertResult {
        id: string;
        validated_at: Date;
      }
let representative: Representative | undefined;
      let client;
      let districtResult;
      let insertResult: { rows: InsertResult[] };
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        districtResult = await client.query<DistrictQueryResult>(districtQuery, [lng, lat]);

      if (districtResult.rows.length > 0) {
        const row = districtResult.rows[0];
        district = {
          id: row.id,
          ssdd: row.ssdd,
          state: row.state,
          districtNumber: row.district_number,
          name: row.name,
          boundary: JSON.parse(row.boundary) as Geometry,
          areaSquareKm: row.area_sq_km ? Number(row.area_sq_km) : undefined,
          centroid: row.centroid ? parseCentroid(row.centroid) : undefined,
          metadata: row.metadata,
        };

        logger.info('District found', { districtId: district.id, ssdd: district.ssdd });

        // Step 4: Get representative info for the district
        const memberQuery = `
          SELECT
            id,
            district_id,
            ssdd,
            member_id,
            name,
            first_name,
            last_name,
            party,
            state,
            district_number,
            office_address,
            phone,
            email,
            website_url,
            twitter_handle,
            facebook_url,
            youtube_url,
            committee_assignments,
            leadership_position,
            term_start_date,
            term_end_date,
            photo_url,
            bio,
            last_synced_at
          FROM plugin_ssdd_validator.members
          WHERE district_id = $1
          ORDER BY last_synced_at DESC
          LIMIT 1
        `;

        const memberResult = await client.query<MemberQueryResult>(memberQuery, [district.id]);

        if (memberResult.rows.length > 0) {
          const member = memberResult.rows[0];
          representative = {
            id: member.id,
            districtId: member.district_id,
            ssdd: member.ssdd,
            memberId: member.member_id,
            name: member.name,
            firstName: member.first_name,
            lastName: member.last_name,
            party: member.party,
            state: member.state,
            districtNumber: member.district_number,
            officeAddress: member.office_address,
            phone: member.phone,
            email: member.email,
            websiteUrl: member.website_url,
            twitterHandle: member.twitter_handle,
            facebookUrl: member.facebook_url,
            youtubeUrl: member.youtube_url,
            committeeAssignments: member.committee_assignments,
            leadershipPosition: member.leadership_position,
            termStartDate: member.term_start_date,
            termEndDate: member.term_end_date,
            photoUrl: member.photo_url,
            bio: member.bio,
            lastSyncedAt: member.last_synced_at,
          };

          logger.info('Representative found', { representativeName: representative.name });
        }
      } else {
        logger.warn('No congressional district found for coordinates', { lat, lng });
      }

      // Step 5: Save validated address to database
      const insertQuery = `
        INSERT INTO plugin_ssdd_validator.addresses (
          original_address,
          validated_address,
          street_address,
          city,
          state,
          zip_code,
          latitude,
          longitude,
          location,
          validation_status,
          validation_source,
          district_id,
          validated_at,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          ST_SetSRID(ST_MakePoint($9, $10), 4326),
          $11, $12, $13, $14, $15
        )
        RETURNING id, validated_at
      `;

      const originalAddress = [
        sanitizedStreet1,
        sanitizedStreet2,
        sanitizedCity,
        sanitizedState,
        sanitizedZip,
      ]
        .filter(Boolean)
        .join(', ');

      const validatedAddress = [
        validated.street1,
        validated.street2,
        validated.city,
        validated.state,
        validated.zip,
        validated.zip4,
      ]
        .filter(Boolean)
        .join(', ');

      insertResult = await client.query<InsertResult>(insertQuery, [
        originalAddress,
        validatedAddress,
        validated.street1 + (validated.street2 ? ' ' + validated.street2 : ''),
        validated.city,
        validated.state,
        validated.zip + (validated.zip4 ? '-' + validated.zip4 : ''),
        lat,
        lng,
        lng, // PostGIS uses lng, lat order
        lat,
        'valid',
        'usps',
        district?.id || null,
        new Date().toISOString(),
        userId,
      ]);

      await client.query('COMMIT');
    } catch (dbErr) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rbErr) {
          logger.error('Failed to ROLLBACK transaction in validateAddress', rbErr as Error);
        }
      }
      throw dbErr;
    } finally {
      if (client) {
        client.release();
      }
    }

    const address: Address = {
        id: insertResult.rows[0].id,
        userId,
        originalStreet1: sanitizedStreet1,
        originalStreet2: sanitizedStreet2,
        originalCity: sanitizedCity,
        originalState: sanitizedState,
        originalZip: sanitizedZip,
        standardizedStreet1: validated.street1,
        standardizedStreet2: validated.street2,
        standardizedCity: validated.city,
        standardizedState: validated.state,
        standardizedZip: validated.zip,
        standardizedZip4: validated.zip4,
        coordinates: { lat, lng },
        districtId: district?.id,
        validatedAt: insertResult.rows[0].validated_at,
        validationStatus: 'valid',
        validationSource: 'usps',
      };

      logger.info('Address saved to database', { addressId: address.id });

      // Return success response
      res.status(200).json({
        success: true,
        address,
        district,
        representative,
      } as ValidateAddressResponse);
    } catch (error) {
      logger.error('Error validating address', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while validating address',
      } as ValidateAddressResponse);
    }
  };
}

/**
 * Parse PostGIS centroid text to coordinates
 * Example: "POINT(-122.4194 37.7749)" -> { lat: 37.7749, lng: -122.4194 }
 */
// parseCentroid moved to utils/postgis
