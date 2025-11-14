import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Creates a validation middleware using Zod schema.
 * Validates the request body against the provided schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post('/', validate(createMenuSchema), async (req, res) => {
 *   // req.body is now validated and typed
 * });
 * ```
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate the request body
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors for better readability
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: formattedErrors,
        });
        return;
      }

      // Unexpected error
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Menu validation schemas
 */

// Menu location enum
const menuLocationSchema = z.enum(['header', 'footer', 'custom']);

// CreateMenuRequest schema
export const createMenuSchema = z.object({
  name: z.string().min(1, 'Menu name is required').max(255, 'Menu name must be less than 255 characters'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
    .max(255)
    .optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  location: menuLocationSchema.optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// UpdateMenuRequest schema
export const updateMenuSchema = z.object({
  name: z.string().min(1, 'Menu name is required').max(255, 'Menu name must be less than 255 characters').optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
    .max(255)
    .optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').nullable().optional(),
  location: menuLocationSchema.optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// CreateMenuItemRequest schema
export const createMenuItemSchema = z.object({
  label: z.string().min(1, 'Label is required').max(255, 'Label must be less than 255 characters'),
  url: z.string().min(1, 'URL is required').max(2048, 'URL must be less than 2048 characters'),
  parent_id: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
  is_external: z.boolean().optional(),
  open_in_new_tab: z.boolean().optional(),
  icon: z.string().max(255, 'Icon must be less than 255 characters').nullable().optional(),
  rel: z.string().max(255, 'Rel attribute must be less than 255 characters').nullable().optional(),
  order_index: z.number().int().min(0, 'Order index must be a non-negative integer').optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  visibility_roles: z.array(z.string()).optional(),
});

// UpdateMenuItemRequest schema
export const updateMenuItemSchema = z.object({
  label: z.string().min(1, 'Label is required').max(255, 'Label must be less than 255 characters').optional(),
  url: z.string().min(1, 'URL is required').max(2048, 'URL must be less than 2048 characters').optional(),
  parent_id: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
  is_external: z.boolean().optional(),
  open_in_new_tab: z.boolean().optional(),
  icon: z.string().max(255, 'Icon must be less than 255 characters').nullable().optional(),
  rel: z.string().max(255, 'Rel attribute must be less than 255 characters').nullable().optional(),
  order_index: z.number().int().min(0, 'Order index must be a non-negative integer').optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  visibility_roles: z.array(z.string()).optional(),
});
