import { Router, type Request, type Response } from 'express';
import { menuService } from '../server';
import { asyncHandler } from '../utils/asyncHandler';

const publicMenusRouter = Router();

publicMenusRouter.get(
  '/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug).toLowerCase();
    const menu = await menuService.getPublicMenuBySlug(slug);
    if (!menu) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    res.json({ menu });
  })
);

export default publicMenusRouter;
