/**
 * Get district by coordinates handler
 * Finds congressional district for given lat/lng coordinates using PostGIS
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { Geometry } from 'geojson';
import type { District, DistrictQueryResult, MemberQueryResult, Representative } from '../types';
import { parseCentroid } from '../utils/postgis';

/**
 * Get district by coordinates handler
 */
export function getDistrictByCoordinatesHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      const { lat, lng } = req.params;

      // Validate coordinates
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        res.status(400).json({
          success: false,
          error: 'Invalid coordinates. lat and lng must be valid numbers',
        });
        return;
      }

      if (latitude < -90 || latitude > 90) {
        res.status(400).json({
          success: false,
          error: 'Invalid latitude. Must be between -90 and 90',
        });
        return;
      }

      if (longitude < -180 || longitude > 180) {
        res.status(400).json({
          success: false,
          error: 'Invalid longitude. Must be between -180 and 180',
        });
        return;
      }

      logger.info('Looking up district by coordinates', { lat: latitude, lng: longitude });

      // Find congressional district using PostGIS
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

      const districtResult = await pool.query<DistrictQueryResult>(districtQuery, [longitude, latitude]);

      if (districtResult.rows.length === 0) {
        logger.info('No district found for coordinates', { lat: latitude, lng: longitude });
        res.status(404).json({
          success: false,
          error: 'No congressional district found for these coordinates',
        });
        return;
      }

      const row = districtResult.rows[0];

      // Parse GeoJSON boundary with error handling
      let boundary: Geometry;
      try {
        boundary = JSON.parse(row.boundary) as Geometry;
      } catch (parseError) {
        logger.error('Failed to parse district boundary GeoJSON', parseError as Error, {
          districtId: row.id
        });
        res.status(400).json({
          success: false,
          error: 'District boundary data is malformed',
        });
        return;
      }

      const district: District = {
        id: row.id,
        ssdd: row.ssdd,
        state: row.state,
        districtNumber: row.district_number,
        name: row.name,
        boundary,
        areaSquareKm: row.area_sq_km ? Number(row.area_sq_km) : undefined,
        centroid: (function () {
          if (!row.centroid) {return undefined;}
          try {
            return parseCentroid(row.centroid);
          } catch (_e) {
            logger.warn('Invalid centroid format, ignoring', { districtId: row.id });
            return undefined;
          }
        })(),
        metadata: row.metadata,
      };

      logger.info('District found', { districtId: district.id, ssdd: district.ssdd });

      // Get representative info for the district
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

      const memberResult = await pool.query<MemberQueryResult>(memberQuery, [district.id]);

      let representative: Representative | undefined;

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

        district.representative = representative;

        logger.info('Representative found', { representativeName: representative.name });
      }

      res.status(200).json({
        success: true,
        district,
        representative,
      });
    } catch (error) {
      logger.error('Error getting district by coordinates', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while looking up district',
      });
    }
  };
}

/**
 * Parse PostGIS centroid text to coordinates
 * Example: "POINT(-122.4194 37.7749)" -> { lat: 37.7749, lng: -122.4194 }
 */
// parseCentroid moved to utils/postgis

