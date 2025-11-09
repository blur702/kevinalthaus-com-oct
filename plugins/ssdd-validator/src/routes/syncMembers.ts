/**
 * Sync members handler
 * Synchronizes congressional member data from House API
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { HttpResponse } from '@monorepo/shared';
import type { SyncMembersResponse } from '../types';

interface HouseMemberData {
  id?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  party: string;
  state: string;
  district?: number | string;
  officeAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  twitter?: string;
  facebook?: string;
  youtube?: string;
  committees?: Array<{
    name: string;
    role?: string;
    subcommittees?: string[];
  }>;
  leadershipPosition?: string;
  termStart?: string;
  termEnd?: string;
  photoUrl?: string;
  bio?: string;
  [key: string]: unknown;
}

interface HouseMembersResponse {
  success: boolean;
  members?: HouseMemberData[];
  error?: string;
}

/**
 * Sync members handler
 */
export function syncMembersHandler(context: PluginExecutionContext) {
  return async (_req: Request, res: Response): Promise<void> => {
    const { logger, db, services } = context;
    const pool = db as Pool;

    try {
      logger.info('Starting congressional members sync');

      // Step 1: Fetch members from House API via Python service
      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://python-service:8000';

      const membersResponse: HttpResponse<HouseMembersResponse> = await services.http.get<HouseMembersResponse>(
        `${pythonServiceUrl}/house/members`
      );

      const membersData: HouseMembersResponse = membersResponse.data;

      if (!membersData.success || !membersData.members) {
        logger.error(`Failed to fetch members from House API: ${membersData.error || 'Unknown error'}`);
        res.status(500).json({
          success: false,
          syncedCount: 0,
          errors: [membersData.error || 'Failed to fetch members from House API'],
          lastSyncedAt: new Date(),
        } as SyncMembersResponse);
        return;
      }

      const members = membersData.members;
      logger.info(`Fetched ${members.length} members from House API`);

      // Step 2: Sync each member to database
      let syncedCount = 0;
      const errors: string[] = [];

      for (const member of members) {
        try {
          // Validate and normalize state
          const state = member.state?.toUpperCase();
          if (!state || !/^[A-Z]{2}$/.test(state)) {
            logger.warn(`Invalid state for member: ${member.name}`, { state: member.state });
            errors.push(`Invalid state for ${member.name}: ${member.state}`);
            continue;
          }

          // Validate and normalize district number
          const districtRaw = member.district as unknown;
          // Accept both number and string; normalize to string digits
          let districtStr: string | null = null;
          if (typeof districtRaw === 'number' && Number.isFinite(districtRaw)) {
            districtStr = String(Math.trunc(districtRaw));
          } else if (typeof districtRaw === 'string') {
            districtStr = districtRaw.trim();
          }
          if (!districtStr || !/^\d+$/.test(districtStr)) {
            logger.warn(`Invalid district number for member: ${member.name}`, { district: member.district });
            errors.push(`Invalid district number for ${member.name}: ${member.district}`);
            continue;
          }

          // Construct SSDD (state-district) identifier
          const districtNumber = districtStr.padStart(2, '0');
          const ssdd = `${state}-${districtNumber}`;

          // Find district ID
          const districtQuery = `
            SELECT id
            FROM plugin_ssdd_validator.districts
            WHERE ssdd = $1
            LIMIT 1
          `;

          const districtResult = await pool.query<{ id: string }>(districtQuery, [ssdd]);

          if (districtResult.rows.length === 0) {
            logger.warn(`District not found for SSDD: ${ssdd}`, { memberName: member.name });
            errors.push(`District not found for ${ssdd} (${member.name})`);
            continue;
          }

          const districtId = districtResult.rows[0].id;

          // Upsert member
          const upsertQuery = `
            INSERT INTO plugin_ssdd_validator.members (
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
              raw_data,
              last_synced_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP
            )
            ON CONFLICT (district_id)
            DO UPDATE SET
              member_id = EXCLUDED.member_id,
              name = EXCLUDED.name,
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              party = EXCLUDED.party,
              office_address = EXCLUDED.office_address,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              website_url = EXCLUDED.website_url,
              twitter_handle = EXCLUDED.twitter_handle,
              facebook_url = EXCLUDED.facebook_url,
              youtube_url = EXCLUDED.youtube_url,
              committee_assignments = EXCLUDED.committee_assignments,
              leadership_position = EXCLUDED.leadership_position,
              term_start_date = EXCLUDED.term_start_date,
              term_end_date = EXCLUDED.term_end_date,
              photo_url = EXCLUDED.photo_url,
              bio = EXCLUDED.bio,
              raw_data = EXCLUDED.raw_data,
              last_synced_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `;

          await pool.query(upsertQuery, [
            districtId,
            ssdd,
            member.id || null,
            member.name,
            member.firstName || null,
            member.lastName || null,
            member.party,
            state,
            districtNumber,
            member.officeAddress || null,
            member.phone || null,
            member.email || null,
            member.website || null,
            member.twitter || null,
            member.facebook || null,
            member.youtube || null,
            member.committees ? JSON.stringify(member.committees) : null,
            member.leadershipPosition || null,
            member.termStart || null,
            member.termEnd || null,
            member.photoUrl || null,
            member.bio || null,
            JSON.stringify(member),
          ]);

          syncedCount++;
          logger.info(`Synced member: ${member.name} (${ssdd})`);
        } catch (error) {
          const errorMessage = `Failed to sync ${member.name}: ${(error as Error).message}`;
          logger.error(errorMessage, error as Error);
          errors.push(errorMessage);
        }
      }

      // Step 3: Update last sync timestamp in settings
      const updateSettingsQuery = `
        INSERT INTO plugin_ssdd_validator.settings (key, value, category, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key, category)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `;

      await pool.query(updateSettingsQuery, [
        'last_member_sync',
        new Date().toISOString(),
        'plugin',
        'Timestamp of last congressional members sync',
      ]);

      const lastSyncedAt = new Date();

      logger.info('Congressional members sync complete', {
        syncedCount,
        totalMembers: members.length,
        errorCount: errors.length,
      });

      res.status(200).json({
        success: true,
        syncedCount,
        errors: errors.length > 0 ? errors : undefined,
        lastSyncedAt,
      } as SyncMembersResponse);
    } catch (error) {
      logger.error('Error syncing congressional members', error as Error);
      res.status(500).json({
        success: false,
        syncedCount: 0,
        errors: [(error as Error).message],
        lastSyncedAt: new Date(),
      } as SyncMembersResponse);
    }
  };
}

