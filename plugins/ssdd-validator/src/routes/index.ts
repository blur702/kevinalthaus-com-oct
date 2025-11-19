/**
 * Route factory for SSDD Validator Plugin
 * Creates Express router and registers all handlers
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { Role, PluginExecutionContext } from '@monorepo/shared';
import { validateAddressHandler } from './validateAddress';
import { getDistrictByCoordinatesHandler } from './getDistrict';
import { getSettingsHandler, updateSettingsHandler } from './settings';
import { listAddressesHandler } from './listAddresses';
import { listDistrictsHandler } from './listDistricts';
import { getRepresentativeHandler } from './getRepresentative';
import { importKMLHandler } from './importKML';
import { syncMembersHandler } from './syncMembers';
import { listAllAddressesHandler } from './adminAddresses';
import { getAnalyticsHandler } from './adminAnalytics';

/**
 * Middleware to require admin role
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (req.user.role !== Role.ADMIN) {
    res.status(403).json({ success: false, error: 'Admin role required' });
    return;
  }

  next();
}

/**
 * Middleware to require authentication (any authenticated user)
 */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Create SSDD Validator router with all route handlers
 */
export function createSSDDRouter(context: PluginExecutionContext): Router {
  const router = Router();

  // Address validation endpoint (authenticated users)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/validate', requireAuth, validateAddressHandler(context));

  // District lookup endpoint (authenticated users)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/district/:lat/:lng', requireAuth, getDistrictByCoordinatesHandler(context));

  // Address history endpoint (authenticated users)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/addresses', requireAuth, listAddressesHandler(context));

  // Districts list endpoint (authenticated users)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/districts', requireAuth, listDistrictsHandler(context));

  // Representative info endpoint (authenticated users)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/district/:state/:number/representative', requireAuth, getRepresentativeHandler(context));

  // Settings endpoints (admin only)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/settings', requireAdmin, getSettingsHandler(context));
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.put('/settings', requireAdmin, updateSettingsHandler(context));

  // KML import endpoint (admin only)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/import-kml', requireAdmin, importKMLHandler(context));

  // Member sync endpoint (admin only)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.post('/sync-members', requireAdmin, syncMembersHandler(context));

  // Admin endpoints (admin only)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/admin/addresses', requireAdmin, listAllAddressesHandler(context));
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/admin/analytics', requireAdmin, getAnalyticsHandler(context));

  return router;
}
