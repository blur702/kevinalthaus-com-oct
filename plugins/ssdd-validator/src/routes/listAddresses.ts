/**
 * List addresses handler
 * Returns validated address history for the authenticated user
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext } from '@monorepo/shared';
import type { Address } from '../types';

interface AddressQueryResult {
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
}

/**
 * List addresses handler
 */
export function listAddressesHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db } = context;
    const pool = db as Pool;

    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

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

      logger.info('Listing addresses for user', { userId, limit, offset });

      // Query addresses for user with pagination
      const query = `
        SELECT
          id,
          original_address,
          validated_address,
          street_address,
          city,
          state,
          zip_code,
          latitude,
          longitude,
          validation_status,
          validation_source,
          alternative_addresses,
          district_id,
          validated_at,
          created_at,
          created_by
        FROM plugin_ssdd_validator.addresses
        WHERE created_by = $1
        ORDER BY created_at DESC
        LIMIT $2
        OFFSET $3
      `;

      const result = await pool.query<AddressQueryResult>(query, [userId, limit, offset]);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM plugin_ssdd_validator.addresses
        WHERE created_by = $1
      `;

      const countResult = await pool.query<{ total: string }>(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].total, 10);

      // Map database rows to Address objects
      const addresses: Address[] = result.rows.map(row => {
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

        return {
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
      });

      logger.info('Addresses retrieved successfully', { count: addresses.length, total });

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
      logger.error('Error listing addresses', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while listing addresses',
      });
    }
  };
}

