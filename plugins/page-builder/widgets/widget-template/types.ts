/**
 * Widget Template Type Definitions
 *
 * This file defines TypeScript types for the widget's configuration.
 * Types should align with the Joi schema defined in config.ts.
 */

import { WidgetConfig } from '../../src/types';

/**
 * Widget Template Configuration Interface
 *
 * Extends the base WidgetConfig interface and defines all configuration
 * properties for this widget with proper TypeScript types.
 *
 * IMPORTANT: Keep these types aligned with the Joi schema in config.ts
 * - Same field names
 * - Same types (string, number, boolean, etc.)
 * - Same optional/required status
 * - Same union types for enums
 */
export interface WidgetTemplateConfig extends WidgetConfig {
  /**
   * Main content to display in the widget
   * Required field (no ? modifier)
   */
  content: string;

  /**
   * Text alignment option
   * Union type matching the Joi .valid() values
   */
  alignment: 'left' | 'center' | 'right';

  /**
   * Whether to show a border around the widget
   */
  showBorder: boolean;

  /**
   * Border color in hex format (e.g., #FF0000)
   * Optional - only present when showBorder is true
   */
  borderColor?: string;
}

/**
 * Additional widget-specific types (if needed)
 *
 * You can define additional types here for:
 * - Internal component state
 * - Helper types for complex configurations
 * - Enums for option values
 * - Union types for nested structures
 */

/**
 * Example: Alignment enum (alternative to string literal union)
 */
export enum TextAlignment {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right'
}

/**
 * Example: Border style type (for future enhancements)
 */
export interface BorderStyle {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
}
