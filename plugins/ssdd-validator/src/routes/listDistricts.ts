/**
 * List districts handler
 * Returns all congressional districts with boundaries and optional representative info
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { Geometry } from 'geojson';
import type { District } from '../types';
import { parseCentroid } from '../utils/postgis';

/**
 * List districts handler
 */
export function listDistrictsHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      // Get query parameters
      const state = req.query.state ? String(req.query.state).toUpperCase() : undefined;
      const includeRepresentatives = req.query.includeRepresentatives === 'true';
      const limit = parseInt(String(req.query.limit || '100'), 10);
      const offset = parseInt(String(req.query.offset || '0'), 10);

      // Validate pagination parameters
      if (isNaN(limit) || limit < 1 || limit > 500) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter. Must be between 1 and 500',
        });
        return;
      }

      if (isNaN(offset) || offset < 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid offset parameter. Must be >= 0',
        });
        return;
      }

      // Validate state format if provided
      if (state && !/^[A-Z]{2}$/.test(state)) {
        res.status(400).json({
          success: false,
          error: 'Invalid state format. Must be 2-letter state code (e.g., CA, NY)',
        });
        return;
      }

      logger.info('Listing districts', { state, includeRepresentatives, limit, offset });

      // Build query
      let query = `
        SELECT
          d.id,
          d.ssdd,
          d.state,
          d.district_number,
          d.name,
          ST_AsGeoJSON(d.boundary) as boundary,
          d.area_sq_km,
          ST_AsText(d.centroid) as centroid,
          d.metadata
      `;

      if (includeRepresentatives) {
        query += `,
          m.id as member_id,
          m.member_id as external_member_id,
          m.name as member_name,
          m.first_name,
          m.last_name,
          m.party,
          m.office_address,
          m.phone,
          m.email,
          m.website_url,
          m.twitter_handle,
          m.facebook_url,
          m.youtube_url,
          m.committee_assignments,
          m.leadership_position,
          m.term_start_date,
          m.term_end_date,
          m.photo_url,
          m.bio,
          m.last_synced_at
        `;
      }

      query += `
        FROM plugin_ssdd_validator.districts d
      `;

      if (includeRepresentatives) {
        query += `
          LEFT JOIN plugin_ssdd_validator.members m ON d.id = m.district_id
        `;
      }

      const queryParams: (string | number)[] = [];
      let paramIndex = 1;

      if (state) {
        query += ` WHERE d.state = $${paramIndex}`;
        queryParams.push(state);
        paramIndex++;
      }

      query += ` ORDER BY d.state, d.district_number`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      interface ListDistrictsRow {
        id: string;
        ssdd: string;
        state: string;
        district_number: string;
        name: string;
        boundary: string;
        area_sq_km: number | null;
        centroid: string | null;
        metadata: Record<string, unknown> | null;
        member_id?: string;
        external_member_id?: string;
        member_name?: string;
        first_name?: string;
        last_name?: string;
        party?: string;
        office_address?: string;
        phone?: string;
        email?: string;
        website_url?: string;
        twitter_handle?: string;
        facebook_url?: string;
        youtube_url?: string;
        committee_assignments?: Array<{ name: string; role?: string; subcommittees?: string[] }>;
        leadership_position?: string;
        term_start_date?: string;
        term_end_date?: string;
        photo_url?: string;
        bio?: string;
        last_synced_at?: Date;
      }

      const result = await pool.query<ListDistrictsRow>(query, queryParams);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM plugin_ssdd_validator.districts
      `;

      const countParams: string[] = [];
      if (state) {
        countQuery += ' WHERE state = $1';
        countParams.push(state);
      }

      const countResult = await pool.query<{ total: string }>(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total, 10);

      // Map results to District objects
      const districts: District[] = result.rows.map(row => {
        const district: District = {
          id: row.id,
          ssdd: row.ssdd,
          state: row.state,
          districtNumber: row.district_number,
          name: row.name,
          boundary: JSON.parse(row.boundary) as Geometry,
          areaSquareKm: row.area_sq_km ? Number(row.area_sq_km) : undefined,
          centroid: row.centroid ? parseCentroid(row.centroid) : undefined,
          metadata: row.metadata ?? undefined,
        };

        // Add representative if requested and available
        if (includeRepresentatives && row.member_id && row.member_name && row.party && row.last_synced_at) {
          district.representative = {
            id: row.member_id,
            districtId: row.id,
            ssdd: row.ssdd,
            memberId: row.external_member_id,
            name: row.member_name,
            firstName: row.first_name,
            lastName: row.last_name,
            party: row.party,
            state: row.state,
            districtNumber: row.district_number,
            officeAddress: row.office_address,
            phone: row.phone,
            email: row.email,
            websiteUrl: row.website_url,
            twitterHandle: row.twitter_handle,
            facebookUrl: row.facebook_url,
            youtubeUrl: row.youtube_url,
            committeeAssignments: row.committee_assignments,
            leadershipPosition: row.leadership_position,
            termStartDate: row.term_start_date,
            termEndDate: row.term_end_date,
            photoUrl: row.photo_url,
            bio: row.bio,
            lastSyncedAt: row.last_synced_at,
          };
        }

        return district;
      });

      logger.info('Districts retrieved successfully', { count: districts.length, total });

      res.status(200).json({
        success: true,
        districts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + districts.length < total,
        },
      });
    } catch (error) {
      logger.error('Error listing districts', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while listing districts',
      });
    }
  };
}

/**
 * Parse PostGIS centroid text to coordinates
 * Example: "POINT(-122.4194 37.7749)" -> { lat: 37.7749, lng: -122.4194 }
 */
// parseCentroid moved to utils/postgis
