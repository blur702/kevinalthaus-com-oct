import { Router, type Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role, type CreateMenuRequest, type UpdateMenuRequest, type CreateMenuItemRequest, type UpdateMenuItemRequest, ValidationError } from '@monorepo/shared';
import { menuService } from '../server';
import { asyncHandler } from '../utils/asyncHandler';
import { Sentry, isSentryEnabled } from '../instrument';
import {
  validate,
  createMenuSchema,
  updateMenuSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from '../middleware/zodValidation';

const menusRouter = Router();

// Custom error classes for proper error handling
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Handles menu-related errors and sends appropriate HTTP responses
 * @param error - The error to handle (unknown type)
 * @param res - Express Response object
 */
function handleMenuError(error: unknown, res: Response): void {
  // Use instanceof checks for proper error classification
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof UnauthorizedError) {
    res.status(401).json({ error: error.message });
    return;
  }

  // Fallback to string matching for errors not using custom classes
  const err = error instanceof Error ? error : new Error(String(error));
  const errorMessage = err.message.toLowerCase();

  if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (errorMessage.includes('unauthorized')) {
    res.status(401).json({ error: err.message });
    return;
  }

  if (errorMessage.includes('forbidden')) {
    res.status(403).json({ error: err.message });
    return;
  }

  // Unexpected errors - capture to Sentry and return 500
  if (isSentryEnabled) {
    Sentry.captureException(err);
  }
  res.status(500).json({ error: 'Internal server error' });
}

menusRouter.use(authMiddleware);
menusRouter.use(requireRole(Role.ADMIN));

menusRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const includeItems = req.query.includeItems !== 'false';
    const activeOnly = req.query.activeOnly === 'true';
    const menus = await menuService.listMenus({ includeItems, activeOnly });
    res.json({ menus });
  })
);

menusRouter.post(
  '/',
  validate(createMenuSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const data = req.body as CreateMenuRequest;

    const menu = await menuService.createMenu(data, userId);
    res.status(201).json({ menu });
  })
);

menusRouter.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const includeItems = req.query.includeItems !== 'false';
    const menu = await menuService.getMenuById(req.params.id, { includeItems });
    if (!menu) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    res.json({ menu });
  })
);

menusRouter.put(
  '/:id',
  validate(updateMenuSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as UpdateMenuRequest;
    try {
      const menu = await menuService.updateMenu(req.params.id, data, req.user!.id);
      res.json({ menu });
    } catch (error) {
      handleMenuError(error, res);
    }
  })
);

menusRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await menuService.deleteMenu(req.params.id);
    res.status(204).send();
  })
);

menusRouter.post(
  '/:id/items',
  validate(createMenuItemSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as CreateMenuItemRequest;
    try {
      const item = await menuService.createMenuItem(req.params.id, data, req.user!.id);
      res.status(201).json({ item });
    } catch (error) {
      handleMenuError(error, res);
    }
  })
);

menusRouter.put(
  '/:menuId/items/:itemId',
  validate(updateMenuItemSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as UpdateMenuItemRequest;
    try {
      const item = await menuService.updateMenuItem(req.params.itemId, data, req.user!.id);
      res.json({ item });
    } catch (error) {
      handleMenuError(error, res);
    }
  })
);

menusRouter.delete(
  '/:menuId/items/:itemId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      await menuService.deleteMenuItem(req.params.itemId);
      res.status(204).send();
    } catch (error) {
      handleMenuError(error, res);
    }
  })
);

export default menusRouter;
