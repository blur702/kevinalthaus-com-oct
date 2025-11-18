import type { Pool } from 'pg';

/**
 * Seed default taxonomy vocabularies
 * Creates 'categories' and 'tags' vocabularies if they don't exist
 * Safe to run multiple times (idempotent)
 */
export async function seedDefaultVocabularies(
  pool: Pool
): Promise<{ success: boolean; created: number; existing: number }> {
  try {
    // Check if vocabularies already exist
    const checkResult = await pool.query(
      `SELECT machine_name FROM vocabularies WHERE machine_name IN ('categories', 'tags')`
    );

    const existingVocabs = new Set(checkResult.rows.map((row) => row.machine_name));
    let created = 0;

    // Create 'categories' vocabulary if it doesn't exist
    if (!existingVocabs.has('categories')) {
      await pool.query(
        `INSERT INTO vocabularies (name, machine_name, description, hierarchy_depth, allow_multiple, required, weight)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (machine_name) DO NOTHING`,
        [
          'Categories',
          'categories',
          'Content categories for organizing posts and pages',
          2, // Allow parent-child relationships
          true, // Allow multiple categories per entity
          false, // Not required
          0, // Weight/sort order
        ]
      );
      console.log('[Seed] Created "categories" vocabulary');
      created++;
    } else {
      console.log('[Seed] "categories" vocabulary already exists');
    }

    // Create 'tags' vocabulary if it doesn't exist
    if (!existingVocabs.has('tags')) {
      await pool.query(
        `INSERT INTO vocabularies (name, machine_name, description, hierarchy_depth, allow_multiple, required, weight)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (machine_name) DO NOTHING`,
        [
          'Tags',
          'tags',
          'Tags for content classification',
          0, // Flat structure (no hierarchy)
          true, // Allow multiple tags per entity
          false, // Not required
          1, // Weight/sort order
        ]
      );
      console.log('[Seed] Created "tags" vocabulary');
      created++;
    } else {
      console.log('[Seed] "tags" vocabulary already exists');
    }

    const existing = existingVocabs.size;
    return { success: true, created, existing };
  } catch (error) {
    console.error('[Seed] Failed to seed default vocabularies:', error);
    // Return failure signal but don't throw - allow app to start even if seeding fails
    return { success: false, created: 0, existing: 0 };
  }
}
