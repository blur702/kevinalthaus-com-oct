/**
 * Widget Template Configuration Schema
 *
 * This file defines the Joi validation schema for the widget's configuration.
 * The schema is used for:
 * 1. Validating configuration when saving pages
 * 2. Generating configuration forms in the frontend
 * 3. Ensuring type safety and data integrity
 */

import Joi from 'joi';
import { WidgetTemplateConfig } from './types';

/**
 * Joi validation schema for widget template configuration
 *
 * Common validation patterns:
 * - .required() - Field must be provided
 * - .optional() - Field is optional
 * - .default(value) - Default value if not provided
 * - .min(n).max(n) - Range validation for numbers/strings
 * - .valid(...values) - Enum validation
 * - .pattern(regex) - Regex pattern matching
 * - .when(field, { is: value, then: schema }) - Conditional validation
 *
 * IMPORTANT: Keep schemas JSON-serializable
 * - No functions or circular references
 * - No complex objects that can't be serialized
 */
export const widgetTemplateConfigSchema = Joi.object({
  // Main content - required string
  content: Joi.string()
    .min(1)
    .max(5000)
    .required()
    .description('Main widget content'),

  // Alignment option - enum with default
  alignment: Joi.string()
    .valid('left', 'center', 'right')
    .default('left')
    .description('Text alignment'),

  // Border toggle - boolean with default
  showBorder: Joi.boolean()
    .default(false)
    .description('Whether to show a border around the widget'),

  // Border color - conditional field (only required if showBorder is true)
  borderColor: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .when('showBorder', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('Border color in hex format (e.g., #FF0000)')
});

/**
 * Default configuration values
 *
 * These defaults are used when creating new widget instances.
 * All fields should have sensible defaults to ensure a good initial state.
 */
export const widgetTemplateDefaults: WidgetTemplateConfig = {
  content: 'Enter your content here...',
  alignment: 'left',
  showBorder: false
};

/**
 * Export the schema as default for easier imports
 */
export default widgetTemplateConfigSchema;
