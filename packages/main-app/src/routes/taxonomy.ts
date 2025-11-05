/**
 * Taxonomy API Routes
 * Handles vocabulary and term management for the taxonomy system
 */

import { Router, Request, Response } from 'express';
import { taxonomyService } from '../server';
import { authMiddleware } from '../auth';
import { requireRole } from '../auth/rbac-middleware';
import { Role } from '@monorepo/shared';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateVocabularyData,
  UpdateVocabularyData,
  CreateTermData,
  UpdateTermData,
} from '@monorepo/shared';

export const taxonomyRouter = Router();

// Apply authentication to all routes
taxonomyRouter.use(authMiddleware);

// ============================================================================
// Vocabulary Routes
// ============================================================================

/**
 * GET /api/taxonomy/vocabularies
 * Get all vocabularies
 */
taxonomyRouter.get(
  '/vocabularies',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const vocabularies = await taxonomyService.getAllVocabularies();
    res.json({ vocabularies });
  })
);

/**
 * GET /api/taxonomy/vocabularies/:id
 * Get a single vocabulary by ID
 */
taxonomyRouter.get(
  '/vocabularies/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const vocabulary = await taxonomyService.getVocabulary(id);

    if (!vocabulary) {
      res.status(404).json({ error: 'Vocabulary not found' });
      return;
    }

    res.json({ vocabulary });
  })
);

/**
 * GET /api/taxonomy/vocabularies/machine-name/:machineName
 * Get a vocabulary by machine name
 */
taxonomyRouter.get(
  '/vocabularies/machine-name/:machineName',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { machineName } = req.params;
    const vocabulary = await taxonomyService.getVocabularyByMachineName(machineName);

    if (!vocabulary) {
      res.status(404).json({ error: 'Vocabulary not found' });
      return;
    }

    res.json({ vocabulary });
  })
);

/**
 * POST /api/taxonomy/vocabularies
 * Create a new vocabulary (admin only)
 */
taxonomyRouter.post(
  '/vocabularies',
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateVocabularyData = req.body;

    // Validate required fields
    if (!data.name || !data.machine_name) {
      res.status(400).json({ error: 'Name and machine_name are required' });
      return;
    }

    // Check if machine_name already exists
    const existing = await taxonomyService.getVocabularyByMachineName(data.machine_name);
    if (existing) {
      res.status(409).json({ error: 'A vocabulary with this machine name already exists' });
      return;
    }

    const vocabulary = await taxonomyService.createVocabulary(data);
    res.status(201).json({ vocabulary });
  })
);

/**
 * PUT /api/taxonomy/vocabularies/:id
 * Update a vocabulary (admin only)
 */
taxonomyRouter.put(
  '/vocabularies/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateVocabularyData = req.body;

    try {
      const vocabulary = await taxonomyService.updateVocabulary(id, data);
      res.json({ vocabulary });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Vocabulary not found' });
        return;
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/taxonomy/vocabularies/:id
 * Delete a vocabulary and all its terms (admin only)
 */
taxonomyRouter.delete(
  '/vocabularies/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    await taxonomyService.deleteVocabulary(id);
    res.status(204).send();
  })
);

// ============================================================================
// Term Routes
// ============================================================================

/**
 * GET /api/taxonomy/vocabularies/:vocabularyId/terms
 * Get all terms for a vocabulary
 */
taxonomyRouter.get(
  '/vocabularies/:vocabularyId/terms',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vocabularyId } = req.params;
    const { hierarchy } = req.query;

    if (hierarchy === 'true') {
      // Return hierarchical structure
      const terms = await taxonomyService.buildTermHierarchy(vocabularyId);
      res.json({ terms });
    } else {
      // Return flat list
      const terms = await taxonomyService.getTermsByVocabulary(vocabularyId);
      res.json({ terms });
    }
  })
);

/**
 * GET /api/taxonomy/terms/:id
 * Get a single term by ID
 */
taxonomyRouter.get(
  '/terms/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const term = await taxonomyService.getTerm(id);

    if (!term) {
      res.status(404).json({ error: 'Term not found' });
      return;
    }

    res.json({ term });
  })
);

/**
 * GET /api/taxonomy/terms/:id/children
 * Get all child terms of a term
 */
taxonomyRouter.get(
  '/terms/:id/children',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const children = await taxonomyService.getTermChildren(id);
    res.json({ terms: children });
  })
);

/**
 * GET /api/taxonomy/vocabularies/:vocabularyId/terms/search
 * Search terms within a vocabulary
 */
taxonomyRouter.get(
  '/vocabularies/:vocabularyId/terms/search',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vocabularyId } = req.params;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query (q) is required' });
      return;
    }

    const terms = await taxonomyService.searchTerms(vocabularyId, q);
    res.json({ terms });
  })
);

/**
 * POST /api/taxonomy/terms
 * Create a new term (admin only)
 */
taxonomyRouter.post(
  '/terms',
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateTermData = req.body;

    // Validate required fields
    if (!data.vocabulary_id || !data.name) {
      res.status(400).json({ error: 'vocabulary_id and name are required' });
      return;
    }

    // Check if vocabulary exists
    const vocabulary = await taxonomyService.getVocabulary(data.vocabulary_id);
    if (!vocabulary) {
      res.status(404).json({ error: 'Vocabulary not found' });
      return;
    }

    const term = await taxonomyService.createTerm(data);
    res.status(201).json({ term });
  })
);

/**
 * PUT /api/taxonomy/terms/:id
 * Update a term (admin only)
 */
taxonomyRouter.put(
  '/terms/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateTermData = req.body;

    try {
      const term = await taxonomyService.updateTerm(id, data);
      res.json({ term });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Term not found' });
        return;
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/taxonomy/terms/:id
 * Delete a term and remove all entity associations (admin only)
 */
taxonomyRouter.delete(
  '/terms/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    await taxonomyService.deleteTerm(id);
    res.status(204).send();
  })
);

// ============================================================================
// Entity-Term Association Routes
// ============================================================================

/**
 * GET /api/taxonomy/entities/:entityType/:entityId/terms
 * Get all terms associated with an entity
 */
taxonomyRouter.get(
  '/entities/:entityType/:entityId/terms',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { entityType, entityId } = req.params;
    const terms = await taxonomyService.getEntityTerms(entityType, entityId);
    res.json({ terms });
  })
);

/**
 * POST /api/taxonomy/entities/:entityType/:entityId/terms/:termId
 * Assign a term to an entity (editor role and above)
 */
taxonomyRouter.post(
  '/entities/:entityType/:entityId/terms/:termId',
  requireRole(Role.EDITOR),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { entityType, entityId, termId } = req.params;

    // Check if term exists
    const term = await taxonomyService.getTerm(termId);
    if (!term) {
      res.status(404).json({ error: 'Term not found' });
      return;
    }

    const entityTerm = await taxonomyService.assignTermToEntity(entityType, entityId, termId);
    res.status(201).json({ entityTerm });
  })
);

/**
 * DELETE /api/taxonomy/entities/:entityType/:entityId/terms/:termId
 * Remove a term from an entity (editor role and above)
 */
taxonomyRouter.delete(
  '/entities/:entityType/:entityId/terms/:termId',
  requireRole(Role.EDITOR),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { entityType, entityId, termId } = req.params;

    await taxonomyService.removeTermFromEntity(entityType, entityId, termId);
    res.status(204).send();
  })
);

/**
 * DELETE /api/taxonomy/entities/:entityType/:entityId/terms
 * Clear all terms from an entity (editor role and above)
 */
taxonomyRouter.delete(
  '/entities/:entityType/:entityId/terms',
  requireRole(Role.EDITOR),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { entityType, entityId } = req.params;
    const { vocabularyId } = req.query;

    await taxonomyService.clearEntityTerms(
      entityType,
      entityId,
      vocabularyId ? String(vocabularyId) : undefined
    );
    res.status(204).send();
  })
);

/**
 * GET /api/taxonomy/terms/:termId/entities/:entityType
 * Get all entities of a type that have a specific term
 */
taxonomyRouter.get(
  '/terms/:termId/entities/:entityType',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { termId, entityType } = req.params;

    // Check if term exists
    const term = await taxonomyService.getTerm(termId);
    if (!term) {
      res.status(404).json({ error: 'Term not found' });
      return;
    }

    const entityIds = await taxonomyService.getEntitiesByTerm(entityType, termId);
    res.json({ entityIds, count: entityIds.length });
  })
);
