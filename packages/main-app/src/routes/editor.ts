/**
 * Editor Service Routes
 * Test endpoints for EditorService functionality
 */

import { Router, Request, Response } from 'express';
import { editorService } from '../server';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Convert EditorContent to HTML
 * POST /api/editor/to-html
 */
router.post(
  '/to-html',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const html = editorService.toHTML(content);
    res.json({ html });
  })
);

/**
 * Parse HTML to EditorContent
 * POST /api/editor/from-html
 */
router.post(
  '/from-html',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { html } = req.body;

    if (!html) {
      res.status(400).json({ error: 'HTML is required' });
      return;
    }

    const content = editorService.fromHTML(html);
    res.json({ content });
  })
);

/**
 * Validate EditorContent
 * POST /api/editor/validate
 */
router.post(
  '/validate',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const result = editorService.validate(content);
    res.json(result);
  })
);

/**
 * Sanitize HTML
 * POST /api/editor/sanitize
 */
router.post(
  '/sanitize',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { html } = req.body;

    if (!html) {
      res.status(400).json({ error: 'HTML is required' });
      return;
    }

    const sanitized = editorService.sanitize(html);
    res.json({ sanitized });
  })
);

/**
 * Convert to plain text
 * POST /api/editor/to-text
 */
router.post(
  '/to-text',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const text = editorService.toPlainText(content);
    res.json({ text });
  })
);

/**
 * Get word count
 * POST /api/editor/word-count
 */
router.post(
  '/word-count',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const wordCount = editorService.getWordCount(content);
    const characterCount = editorService.getCharacterCount(content);

    res.json({ wordCount, characterCount });
  })
);

/**
 * Create empty content
 * GET /api/editor/empty
 */
router.get(
  '/empty',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const content = editorService.createEmpty();
    res.json({ content });
  })
);

/**
 * Health check
 * GET /api/editor/health
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const health = await editorService.healthCheck();
    res.status(health.healthy ? 200 : 503).json(health);
  })
);

export { router as editorRouter };
