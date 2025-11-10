import { Router, type Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role, type CreateMenuRequest, type UpdateMenuRequest, type CreateMenuItemRequest, type UpdateMenuItemRequest } from '@monorepo/shared';
import { menuService } from '../server';
import { asyncHandler } from '../utils/asyncHandler';
import {
  validate,
  createMenuSchema,
  updateMenuSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from '../middleware/zodValidation';

const menusRouter = Router();

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
      const err = error as Error;
      const errorMessage = err.message.toLowerCase();

      // Check for validation errors
      if (err.name === 'ValidationError' || errorMessage.includes('invalid') || errorMessage.includes('required')) {
        res.status(400).json({ error: err.message });
        return;
      }

      // Check for not found errors
      if (err.message.includes('not found') || err.message.includes('does not exist')) {
        res.status(404).json({ error: err.message });
        return;
      }

      // Unexpected errors
      res.status(500).json({ error: 'Internal server error' });
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
      res.status(400).json({ error: (error as Error).message });
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
      res.status(400).json({ error: (error as Error).message });
    }
  })
);

menusRouter.delete(
  '/:menuId/items/:itemId',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    await menuService.deleteMenuItem(_req.params.itemId);
    res.status(204).send();
  })
);

export default menusRouter;
