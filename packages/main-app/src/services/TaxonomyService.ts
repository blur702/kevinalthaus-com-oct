/**
 * Taxonomy Service Implementation
 * Provides vocabulary and term management similar to Drupal's taxonomy system
 */

import { Pool, PoolClient } from 'pg';
import type {
  ITaxonomyService,
  Vocabulary,
  Term,
  EntityTerm,
  CreateVocabularyData,
  UpdateVocabularyData,
  CreateTermData,
  UpdateTermData,
} from '@monorepo/shared';

export class TaxonomyService implements ITaxonomyService {
  public readonly name = 'taxonomy';
  private pool: Pool;
  private initialized = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('TaxonomyService is already initialized');
    }
    this.initialized = true;
    console.log('[TaxonomyService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    console.log('[TaxonomyService] ✓ Shutdown');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const result = await this.pool.query('SELECT 1 as health');
      return {
        healthy: result.rows.length > 0,
        message: 'Database connection OK',
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Vocabulary Management
  // ============================================================================

  async createVocabulary(data: CreateVocabularyData): Promise<Vocabulary> {
    const {
      name,
      machine_name,
      description,
      hierarchy_depth = 0,
      allow_multiple = true,
      required = false,
      weight = 0,
    } = data;

    const result = await this.pool.query<Vocabulary>(
      `INSERT INTO vocabularies (
        name, machine_name, description, hierarchy_depth, allow_multiple, required, weight
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [name, machine_name, description, hierarchy_depth, allow_multiple, required, weight]
    );

    return result.rows[0];
  }

  async getVocabulary(id: string): Promise<Vocabulary | null> {
    const result = await this.pool.query<Vocabulary>(
      'SELECT * FROM vocabularies WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getVocabularyByMachineName(machineName: string): Promise<Vocabulary | null> {
    const result = await this.pool.query<Vocabulary>(
      'SELECT * FROM vocabularies WHERE machine_name = $1',
      [machineName]
    );
    return result.rows[0] || null;
  }

  async getAllVocabularies(): Promise<Vocabulary[]> {
    const result = await this.pool.query<Vocabulary>(
      'SELECT * FROM vocabularies ORDER BY weight ASC, name ASC'
    );
    return result.rows;
  }

  async updateVocabulary(id: string, data: UpdateVocabularyData): Promise<Vocabulary> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.hierarchy_depth !== undefined) {
      updates.push(`hierarchy_depth = $${paramIndex++}`);
      values.push(data.hierarchy_depth);
    }
    if (data.allow_multiple !== undefined) {
      updates.push(`allow_multiple = $${paramIndex++}`);
      values.push(data.allow_multiple);
    }
    if (data.required !== undefined) {
      updates.push(`required = $${paramIndex++}`);
      values.push(data.required);
    }
    if (data.weight !== undefined) {
      updates.push(`weight = $${paramIndex++}`);
      values.push(data.weight);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await this.pool.query<Vocabulary>(
      `UPDATE vocabularies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Vocabulary with id ${id} not found`);
    }

    return result.rows[0];
  }

  async deleteVocabulary(id: string): Promise<void> {
    // Delete all terms in this vocabulary first
    await this.pool.query('DELETE FROM terms WHERE vocabulary_id = $1', [id]);

    // Delete the vocabulary
    await this.pool.query('DELETE FROM vocabularies WHERE id = $1', [id]);
  }

  // ============================================================================
  // Term Management
  // ============================================================================

  async createTerm(data: CreateTermData): Promise<Term> {
    const {
      vocabulary_id,
      name,
      slug,
      description,
      parent_id,
      weight = 0,
      meta_data,
    } = data;

    // Auto-generate slug if not provided
    const termSlug = slug || this.generateSlug(name);

    const result = await this.pool.query<Term>(
      `INSERT INTO terms (
        vocabulary_id, name, slug, description, parent_id, weight, meta_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [vocabulary_id, name, termSlug, description, parent_id, weight, JSON.stringify(meta_data || {})]
    );

    return result.rows[0];
  }

  async getTerm(id: string): Promise<Term | null> {
    const result = await this.pool.query<Term>(
      'SELECT * FROM terms WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getTermBySlug(vocabularyId: string, slug: string): Promise<Term | null> {
    const result = await this.pool.query<Term>(
      'SELECT * FROM terms WHERE vocabulary_id = $1 AND slug = $2',
      [vocabularyId, slug]
    );
    return result.rows[0] || null;
  }

  async getTermsByVocabulary(vocabularyId: string): Promise<Term[]> {
    const result = await this.pool.query<Term>(
      'SELECT * FROM terms WHERE vocabulary_id = $1 ORDER BY weight ASC, name ASC',
      [vocabularyId]
    );
    return result.rows;
  }

  async getTermChildren(parentId: string): Promise<Term[]> {
    const result = await this.pool.query<Term>(
      'SELECT * FROM terms WHERE parent_id = $1 ORDER BY weight ASC, name ASC',
      [parentId]
    );
    return result.rows;
  }

  async updateTerm(id: string, data: UpdateTermData): Promise<Term> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.parent_id !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      values.push(data.parent_id);
    }
    if (data.weight !== undefined) {
      updates.push(`weight = $${paramIndex++}`);
      values.push(data.weight);
    }
    if (data.meta_data !== undefined) {
      updates.push(`meta_data = $${paramIndex++}`);
      values.push(JSON.stringify(data.meta_data));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await this.pool.query<Term>(
      `UPDATE terms SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Term with id ${id} not found`);
    }

    return result.rows[0];
  }

  async deleteTerm(id: string): Promise<void> {
    // Remove all entity associations first
    await this.pool.query('DELETE FROM entity_terms WHERE term_id = $1', [id]);

    // Delete the term
    await this.pool.query('DELETE FROM terms WHERE id = $1', [id]);
  }

  // ============================================================================
  // Entity-Term Associations
  // ============================================================================

  async assignTermToEntity(
    entityType: string,
    entityId: string,
    termId: string
  ): Promise<EntityTerm> {
    // Check if association already exists
    const existing = await this.pool.query<EntityTerm>(
      'SELECT * FROM entity_terms WHERE entity_type = $1 AND entity_id = $2 AND term_id = $3',
      [entityType, entityId, termId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const result = await this.pool.query<EntityTerm>(
      `INSERT INTO entity_terms (entity_type, entity_id, term_id)
      VALUES ($1, $2, $3)
      RETURNING *`,
      [entityType, entityId, termId]
    );

    return result.rows[0];
  }

  async removeTermFromEntity(
    entityType: string,
    entityId: string,
    termId: string
  ): Promise<void> {
    await this.pool.query(
      'DELETE FROM entity_terms WHERE entity_type = $1 AND entity_id = $2 AND term_id = $3',
      [entityType, entityId, termId]
    );
  }

  async getEntityTerms(entityType: string, entityId: string): Promise<Term[]> {
    const result = await this.pool.query<Term>(
      `SELECT t.* FROM terms t
       INNER JOIN entity_terms et ON t.id = et.term_id
       WHERE et.entity_type = $1 AND et.entity_id = $2
       ORDER BY t.weight ASC, t.name ASC`,
      [entityType, entityId]
    );
    return result.rows;
  }

  async getEntitiesByTerm(entityType: string, termId: string): Promise<string[]> {
    const result = await this.pool.query<{ entity_id: string }>(
      'SELECT entity_id FROM entity_terms WHERE entity_type = $1 AND term_id = $2',
      [entityType, termId]
    );
    return result.rows.map((row) => row.entity_id);
  }

  async clearEntityTerms(
    entityType: string,
    entityId: string,
    vocabularyId?: string
  ): Promise<void> {
    if (vocabularyId) {
      // Clear terms from a specific vocabulary
      await this.pool.query(
        `DELETE FROM entity_terms
         WHERE entity_type = $1 AND entity_id = $2 AND term_id IN (
           SELECT id FROM terms WHERE vocabulary_id = $3
         )`,
        [entityType, entityId, vocabularyId]
      );
    } else {
      // Clear all terms
      await this.pool.query(
        'DELETE FROM entity_terms WHERE entity_type = $1 AND entity_id = $2',
        [entityType, entityId]
      );
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async buildTermHierarchy(vocabularyId: string): Promise<Term[]> {
    const allTerms = await this.getTermsByVocabulary(vocabularyId);

    // Build a map of terms by ID for quick lookup
    const termMap = new Map<string, Term & { children?: Term[] }>();
    allTerms.forEach((term) => {
      termMap.set(term.id, { ...term, children: [] });
    });

    // Build hierarchy
    const rootTerms: Term[] = [];
    allTerms.forEach((term) => {
      const termWithChildren = termMap.get(term.id)!;
      if (term.parent_id) {
        const parent = termMap.get(term.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(termWithChildren);
        }
      } else {
        rootTerms.push(termWithChildren);
      }
    });

    return rootTerms;
  }

  async searchTerms(vocabularyId: string, query: string): Promise<Term[]> {
    const result = await this.pool.query<Term>(
      `SELECT * FROM terms
       WHERE vocabulary_id = $1 AND (
         name ILIKE $2 OR description ILIKE $2 OR slug ILIKE $2
       )
       ORDER BY weight ASC, name ASC`,
      [vocabularyId, `%${query}%`]
    );
    return result.rows;
  }

  async validateEntityTerms(entityType: string, termIds: string[]): Promise<boolean> {
    if (termIds.length === 0) {
      return true;
    }

    // Check if all term IDs exist
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM terms WHERE id = ANY($1)',
      [termIds]
    );

    const count = parseInt(result.rows[0].count, 10);
    return count === termIds.length;
  }

  // ============================================================================
  // Private Utility Methods
  // ============================================================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
