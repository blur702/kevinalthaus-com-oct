/**
 * Import KML handler
 * Imports congressional district boundary data from KML files
 */

import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { PluginExecutionContext, stripAllHTML } from '@monorepo/shared';
import type { HttpResponse } from '@monorepo/shared';
import type { Geometry } from 'geojson';
import type { District, DistrictQueryResult, KMLImportResponse } from '../types';
import { parseCentroid } from '../utils/postgis';

interface KMLParseResponse {
  success: boolean;
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties?: {
    name?: string;
    description?: string;
    styleUrl?: string;
    [key: string]: unknown;
  };
  error?: string;
}

/**
 * Import KML handler
 */
export function importKMLHandler(context: PluginExecutionContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { logger, db, services } = context;

    try {
      const { state, districtNumber, name } = req.body as {
        state: string;
        districtNumber: string;
        name?: string;
      };
      const file = req.file;

      // Validate required fields
      if (!state || !districtNumber) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: state, districtNumber',
        } as KMLImportResponse);
        return;
      }

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No KML file uploaded',
        } as KMLImportResponse);
        return;
      }

      // Validate file type by extension and MIME
      if (!file.originalname.toLowerCase().endsWith('.kml')) {
        res.status(400).json({
          success: false,
          error: 'Invalid file type. Must be a KML file',
        } as KMLImportResponse);
        return;
      }

      const allowedMimeTypes = [
        'application/vnd.google-earth.kml+xml',
        'application/xml',
        'text/xml',
      ];
      if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          error: `Invalid MIME type: ${file.mimetype}`,
        } as KMLImportResponse);
        return;
      }

      // Enforce file size limit (default 5MB)
      const maxSizeBytes = Number(process.env.KML_MAX_SIZE_BYTES || 5 * 1024 * 1024);
      if (file.size && file.size > maxSizeBytes) {
        res.status(413).json({
          success: false,
          error: `KML file too large. Max size is ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
        } as KMLImportResponse);
        return;
      }

      // Sanitize inputs
      const sanitizedState = stripAllHTML(state.trim().toUpperCase());
      const sanitizedNumber = stripAllHTML(districtNumber.trim().toUpperCase());
      const sanitizedName =
        name && name.trim().length > 0
          ? stripAllHTML(name.trim())
          : `${sanitizedState} Congressional District ${sanitizedNumber}`;

      // Validate state format
      if (!/^[A-Z]{2}$/.test(sanitizedState)) {
        res.status(400).json({
          success: false,
          error: 'Invalid state format. Must be 2-letter state code (e.g., CA, NY)',
        } as KMLImportResponse);
        return;
      }

      // Validate district number format
      if (!/^(0[0-9]|[1-9][0-9]?|AL)$/.test(sanitizedNumber)) {
        res.status(400).json({
          success: false,
          error: 'Invalid district number format. Must be 01-99 or AL for at-large',
        } as KMLImportResponse);
        return;
      }

      const ssdd = `${sanitizedState}-${sanitizedNumber}`;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        } as KMLImportResponse);
        return;
      }

      logger.info('Importing KML file', {
        filename: file.originalname,
        ssdd,
        state: sanitizedState,
        districtNumber: sanitizedNumber,
      });

      // Step 1: Parse KML file via Python service
      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://python-service:8000';

      // Convert file buffer to base64 for transmission
      const headSample = file.buffer.toString('utf8', 0, Math.min(file.buffer.length, 2000));
      if (!headSample.toLowerCase().includes('<kml')) {
        res.status(400).json({
          success: false,
          error: 'Uploaded file does not appear to be valid KML content',
        } as KMLImportResponse);
        return;
      }

      const fileBase64 = file.buffer.toString('base64');

      const parseResponse: HttpResponse<KMLParseResponse> = await services.http.post<KMLParseResponse>(
        `${pythonServiceUrl}/kml/parse`,
        {
          filename: file.originalname,
          content: fileBase64,
          encoding: 'base64',
        },
        { timeout: 15000 }
      );

      const parseData: KMLParseResponse = parseResponse.data;

      if (!parseData.success || !parseData.geometry) {
        logger.error(`KML parsing failed: ${parseData.error || 'Unknown error'}`);
        res.status(400).json({
          success: false,
          error: parseData.error || 'Failed to parse KML file',
        } as KMLImportResponse);
        return;
      }

      const { geometry, properties } = parseData;

      // Validate geometry type (should be Polygon or MultiPolygon)
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
        res.status(400).json({
          success: false,
          error: `Invalid geometry type: ${geometry.type}. Expected Polygon or MultiPolygon`,
        } as KMLImportResponse);
        return;
      }

      logger.info('KML parsed successfully', { geometryType: geometry.type });

      // Step 2: Convert to MultiPolygon if needed
      let multiPolygonCoordinates: number[][][][] = [];

      if (geometry.type === 'Polygon') {
        multiPolygonCoordinates = [geometry.coordinates as number[][][]];
      } else {
        multiPolygonCoordinates = geometry.coordinates as number[][][][];
      }

      // Step 3: Insert or update district in database
      const geoJSON = {
        type: 'MultiPolygon',
        coordinates: multiPolygonCoordinates,
      };

      const upsertQuery = `
        INSERT INTO plugin_ssdd_validator.districts (
          ssdd,
          state,
          district_number,
          name,
          boundary,
          kml_file_name,
          kml_file_path,
          area_sq_km,
          centroid,
          metadata,
          created_by,
          updated_by
        ) VALUES (
          $1, $2, $3, $4,
          ST_GeomFromGeoJSON($5),
          $6, $7,
          ST_Area(ST_GeomFromGeoJSON($5)::geography) / 1000000,
          ST_Centroid(ST_GeomFromGeoJSON($5)),
          $8,
          $9, $9
        )
        ON CONFLICT (ssdd)
        DO UPDATE SET
          name = EXCLUDED.name,
          boundary = EXCLUDED.boundary,
          kml_file_name = EXCLUDED.kml_file_name,
          kml_file_path = EXCLUDED.kml_file_path,
          area_sq_km = EXCLUDED.area_sq_km,
          centroid = EXCLUDED.centroid,
          metadata = EXCLUDED.metadata,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, ssdd, state, district_number, name, area_sq_km, ST_AsText(centroid) as centroid
      `;

      const metadata = {
        originalFilename: file.originalname,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        properties: properties || {},
      };

      interface UpsertResult {
        id: string;
        ssdd: string;
        state: string;
        district_number: string;
        name: string;
        area_sq_km: number | null;
        centroid: string | null;
      }

      // Perform DB upsert and subsequent read in a single transaction
      const client = await (db as Pool).connect();
      let result: { rows: UpsertResult[] } | undefined;
      let districtResult: { rows: DistrictQueryResult[] } | undefined;
      let row: UpsertResult | undefined;
      try {
        await client.query('BEGIN');
        result = await client.query<UpsertResult>(upsertQuery, [
          ssdd,
          sanitizedState,
          sanitizedNumber,
          sanitizedName,
          JSON.stringify(geoJSON),
          file.originalname,
          null, // kml_file_path (we're storing in memory, not on disk)
          metadata,
          userId,
        ]);

      // row will be assigned after verifying result

      // Step 4: Query the full district with boundary
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
        WHERE id = $1
      `;

      if (!result || !result.rows || result.rows.length === 0) {
        throw new Error(`Upsert did not return a row for SSDD: ${ssdd}`);
      }
      row = result.rows[0];

      districtResult = await client.query<DistrictQueryResult>(districtQuery, [row.id]);
      await client.query('COMMIT');
      client.release();
      } catch (dbErr) {
        try { await client.query('ROLLBACK'); } catch {}
        client.release();
        throw dbErr;
      }
      if (!districtResult || !districtResult.rows || districtResult.rows.length === 0) {
        throw new Error('Failed to fetch district after upsert');
      }
      const districtRow = districtResult.rows[0];

      const district: District = {
        id: districtRow.id,
        ssdd: districtRow.ssdd,
        state: districtRow.state,
        districtNumber: districtRow.district_number,
        name: districtRow.name,
        boundary: JSON.parse(districtRow.boundary) as Geometry,
        areaSquareKm: districtRow.area_sq_km ? Number(districtRow.area_sq_km) : undefined,
        centroid: districtRow.centroid ? parseCentroid(districtRow.centroid) : undefined,
        metadata: districtRow.metadata,
      };

      logger.info('KML imported successfully', {
        districtId: district.id,
        ssdd: district.ssdd,
        areaSquareKm: district.areaSquareKm,
      });

      res.status(200).json({
        success: true,
        district,
      } as KMLImportResponse);
    } catch (error) {
      logger.error('Error importing KML', error as Error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while importing KML',
      } as KMLImportResponse);
    }
  };
}

/**
 * Parse PostGIS centroid text to coordinates
 * Example: "POINT(-122.4194 37.7749)" -> { lat: 37.7749, lng: -122.4194 }
 */
// parseCentroid moved to utils/postgis



