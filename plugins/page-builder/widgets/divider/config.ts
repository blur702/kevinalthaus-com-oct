import Joi from 'joi';
import { DividerConfig } from './types';

export const dividerConfigSchema = Joi.object({
  style: Joi.string().valid('solid', 'dashed', 'dotted', 'double').default('solid'),
  width: Joi.number().min(10).max(100).default(100).description('Width as percentage'),
  thickness: Joi.number().min(1).max(20).default(1),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#e0e0e0'),
  alignment: Joi.string().valid('left', 'center', 'right').default('center'),
  marginTop: Joi.number().min(0).max(100).default(20),
  marginBottom: Joi.number().min(0).max(100).default(20)
});

export const dividerDefaults: DividerConfig = {
  style: 'solid',
  width: 100,
  thickness: 1,
  color: '#e0e0e0',
  alignment: 'center',
  marginTop: 20,
  marginBottom: 20
};

export default dividerConfigSchema;
