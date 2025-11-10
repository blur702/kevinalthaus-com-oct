import Joi from 'joi';
import { TextContentConfig } from './types';

export const textContentConfigSchema = Joi.object({
  content: Joi.string().min(0).max(50000).required().description('Rich text content'),
  textAlign: Joi.string().valid('left', 'center', 'right', 'justify').default('left'),
  fontSize: Joi.number().min(8).max(72).default(16),
  lineHeight: Joi.number().min(1).max(3).default(1.5),
  textColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  padding: Joi.number().min(0).max(100).default(0)
});

export const textContentDefaults: TextContentConfig = {
  content: '<p>Enter your text content here...</p>',
  textAlign: 'left',
  fontSize: 16,
  lineHeight: 1.5,
  padding: 0
};

export default textContentConfigSchema;
