/**
 * Admin addresses handler
 * Returns all validated addresses with user information for admin management
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { Address } from '../types';

interface AdminAddressQueryResult {
  id: string;
  original_address: string;
  validated_address: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  validation_status: 'valid' | 'invalid' | 'alternative_suggested' | 'pending';
  validation_source?: string;
  alternative_addresses?: unknown;
  district_id?: string;
  validated_at: Date;
  created_at: Date;
  created_by: string;
  user_id: string;
  user_email: string;
  user_username: string;
  user_role: string;
}

/**
 * List all addresses handler (admin only)
 */
export function listAllAddressesHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      // Get pagination parameters
      const limit = parseInt(String(req.query.limit || '50'), 10);
      const offset = parseInt(String(req.query.offset || '0'), 10);

      // Validate pagination parameters
      if (isNaN(limit) || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter. Must be between 1 and 100',
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

      // Get filter parameters
      const userId = req.query.userId as string | undefined;
      const state = req.query.state as string | undefined;
      const districtId = req.query.districtId as string | undefined;
      const validationStatus = req.query.validationStatus as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      // Validate optional filters
      if (state && !/^[A-Z]{2}$/.test(state)) {
        res.status(400).json({
          success: false,
          error: 'Invalid state parameter. Must be 2-letter state code',
        });
        return;
      }

      if (validationStatus && !['valid', 'invalid', 'alternative_suggested', 'pending'].includes(validationStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid validationStatus parameter. Must be valid, invalid, alternative_suggested, or pending',
        });
        return;
      }

      if (dateFrom && isNaN(Date.parse(dateFrom))) {
        res.status(400).json({
          success: false,
          error: 'Invalid dateFrom parameter. Must be ISO 8601 date string',
        });
        return;
      }

      if (dateTo && isNaN(Date.parse(dateTo))) {
        res.status(400).json({
          success: false,
          error: 'Invalid dateTo parameter. Must be ISO 8601 date string',
        });
        return;
      }

      logger.info('Listing all addresses for admin', { limit, offset, userId, state, districtId, validationStatus, dateFrom, dateTo });

      // Build WHERE clause dynamically
      const whereClauses: string[] = [];
      const queryParams: (string | number)[] = [];
      let paramIndex = 1;

      if (userId) {
        whereClauses.push(`addresses.created_by = $${paramIndex}`);
        queryParams.push(userId);
        paramIndex++;
      }

      if (state) {
        whereClauses.push(`addresses.state = $${paramIndex}`);
        queryParams.push(state);
        paramIndex++;
      }

      if (districtId) {
        whereClauses.push(`addresses.district_id = $${paramIndex}`);
        queryParams.push(districtId);
        paramIndex++;
      }

      if (validationStatus) {
        whereClauses.push(`addresses.validation_status = $${paramIndex}`);
        queryParams.push(validationStatus);
        paramIndex++;
      }

      if (dateFrom) {
        whereClauses.push(`addresses.created_at >= $${paramIndex}`);
        queryParams.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        whereClauses.push(`addresses.created_at <= $${paramIndex}`);
        queryParams.push(dateTo);
        paramIndex++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Query addresses with user information
      const query = `
        SELECT
          addresses.id,
          addresses.original_address,
          addresses.validated_address,
          addresses.street_address,
          addresses.city,
          addresses.state,
          addresses.zip_code,
          addresses.latitude,
          addresses.longitude,
          addresses.validation_status,
          addresses.validation_source,
          addresses.alternative_addresses,
          addresses.district_id,
          addresses.validated_at,
          addresses.created_at,
          addresses.created_by,
          users.id AS user_id,
          users.email AS user_email,
          users.username AS user_username,
          users.role AS user_role
        FROM plugin_ssdd_validator.addresses
        JOIN public.users ON addresses.created_by = users.id
        ${whereClause}
        ORDER BY addresses.created_at DESC
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;

      const result = await pool.query<AdminAddressQueryResult>(query, [...queryParams, limit, offset]);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM plugin_ssdd_validator.addresses
        ${whereClause}
      `;

      const countResult = await pool.query<{ total: string }>(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total, 10);

      // Map database rows to Address objects with user information
      const addresses = result.rows.map(row => {
        // Use structured DB columns for address components
        const street1 = row.street_address;
        const city = row.city;
        const state = row.state;

        // Safely parse zip code with zip4 extension
        const zipParts = row.zip_code ? row.zip_code.split('-') : [];
        const zip = zipParts[0] || '';
        const zip4 = zipParts[1];

        // Parse original address more safely: split from right to preserve commas in street
        let originalStreet1 = street1;
        let originalCity = city;
        let originalState = state;
        let originalZip = zip;
        if (row.original_address) {
          const parts = row.original_address.split(',').map((p) => p.trim());
          if (parts.length >= 3) {
            const candidateZip = parts[parts.length - 1] || '';
            const candidateState = parts[parts.length - 2] || '';
            const candidateCity = parts[parts.length - 3] || '';
            const stateValid = /^[A-Z]{2}$/.test(candidateState.toUpperCase());
            // eslint-disable-next-line security/detect-unsafe-regex
            const zipValid = /^\d{5}(-\d{4})?$/.test(candidateZip);
            if (stateValid) {originalState = candidateState.toUpperCase();}
            if (zipValid) {originalZip = candidateZip;}
            if (candidateCity) {originalCity = candidateCity;}
            if (parts.length > 3) {originalStreet1 = parts.slice(0, parts.length - 3).join(', ');}
          } else if (parts.length === 2) {
            const candidateState = parts[1] || '';
            if (/^[A-Z]{2}$/.test(candidateState.toUpperCase())) {originalState = candidateState.toUpperCase();}
            originalCity = parts[0] || city;
          } else if (parts.length === 1) {
            originalStreet1 = parts[0] || street1;
          }
        }

        const address: Address = {
          id: row.id,
          userId: row.created_by,
          originalStreet1,
          originalCity,
          originalState,
          originalZip,
          standardizedStreet1: street1,
          standardizedCity: city,
          standardizedState: state,
          standardizedZip: zip,
          standardizedZip4: zip4,
          coordinates: {
            lat: row.latitude,
            lng: row.longitude,
          },
          districtId: row.district_id,
          validatedAt: row.validated_at,
          validationStatus: row.validation_status,
          validationSource: row.validation_source,
          alternativeAddresses: row.alternative_addresses as Address['alternativeAddresses'],
        };

        return {
          ...address,
          user: {
            id: row.user_id,
            email: row.user_email,
            username: row.user_username,
            role: row.user_role,
          },
        };
      });

      logger.info('All addresses retrieved successfully', { count: addresses.length, total });

      res.status(200).json({
        success: true,
        addresses,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + addresses.length < total,
        },
      });
    } catch (error) {
      logger.error('Error listing all addresses', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while listing addresses',
      });
    }
  };
}
