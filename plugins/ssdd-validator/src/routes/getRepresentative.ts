/**
 * Get representative handler
 * Returns representative information for a given state and district number
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { Representative, MemberQueryResult } from '../types';

/**
 * Get representative handler
 */
export function getRepresentativeHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      const { state, number } = req.params;

      // Validate state format
      const sanitizedState = state.toUpperCase();
      if (!/^[A-Z]{2}$/.test(sanitizedState)) {
        res.status(400).json({
          success: false,
          error: 'Invalid state format. Must be 2-letter state code (e.g., CA, NY)',
        });
        return;
      }

      // Validate district number format
      const sanitizedNumber = number.toUpperCase();
      // Enforce zero-padded 01-99 or AL; disallow 00
      if (!/^(0[1-9]|[1-9][0-9]|AL)$/.test(sanitizedNumber)) {
        res.status(400).json({
          success: false,
          error: 'Invalid district number format. Must be 01-99 or AL for at-large',
        });
        return;
      }

      logger.info('Getting representative', { state: sanitizedState, number: sanitizedNumber });

      // Query representative by state and district number
      const query = `
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
        WHERE state = $1 AND district_number = $2
        ORDER BY last_synced_at DESC
        LIMIT 1
      `;

      const result = await pool.query<MemberQueryResult>(query, [sanitizedState, sanitizedNumber]);

      if (result.rows.length === 0) {
        logger.info('Representative not found', { state: sanitizedState, number: sanitizedNumber });
        res.status(404).json({
          success: false,
          error: `No representative found for ${sanitizedState}-${sanitizedNumber}`,
        });
        return;
      }

      const member = result.rows[0];
      const representative: Representative = {
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

      res.status(200).json({
        success: true,
        representative,
      });
    } catch (error) {
      logger.error('Error getting representative', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while getting representative',
      });
    }
  };
}
