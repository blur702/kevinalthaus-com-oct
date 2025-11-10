import Joi from 'joi';
import { HeadingConfig } from './types';

export const headingConfigSchema = Joi.object({
  text: Joi.string().min(1).max(500).required().description('Heading text'),
  level: Joi.number().integer().min(1).max(6).required().description('Heading level (1-6)'),
  textAlign: Joi.string().valid('left', 'center', 'right').default('left'),
  fontSize: Joi.number().min(12).max(120).optional().description('Custom font size (overrides default)'),
  fontWeight: Joi.string().valid('normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900').default('bold'),
  textColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  marginTop: Joi.number().min(0).max(100).default(16),
  marginBottom: Joi.number().min(0).max(100).default(16)
});

export const headingDefaults: HeadingConfig = {
  text: 'Enter your heading',
  level: 2,
  textAlign: 'left',
  fontWeight: 'bold',
  marginTop: 16,
  marginBottom: 16
};

export default headingConfigSchema;
