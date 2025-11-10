import Joi from 'joi';
import { ButtonConfig } from './types';

export const buttonConfigSchema = Joi.object({
  text: Joi.string().min(1).max(100).required().description('Button text'),
  url: Joi.string().uri().required().description('Button link URL'),
  openInNewTab: Joi.boolean().default(false),
  size: Joi.string().valid('small', 'medium', 'large').default('medium'),
  variant: Joi.string().valid('primary', 'secondary', 'outline', 'text').default('primary'),
  alignment: Joi.string().valid('left', 'center', 'right').default('left'),
  fullWidth: Joi.boolean().default(false),
  backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  borderRadius: Joi.number().min(0).max(50).default(4),
  padding: Joi.object({
    vertical: Joi.number().min(0).max(50).required(),
    horizontal: Joi.number().min(0).max(100).required()
  }).default({ vertical: 12, horizontal: 24 })
});

export const buttonDefaults: ButtonConfig = {
  text: 'Click Here',
  url: '#',
  openInNewTab: false,
  size: 'medium',
  variant: 'primary',
  alignment: 'left',
  fullWidth: false,
  borderRadius: 4,
  padding: {
    vertical: 12,
    horizontal: 24
  }
};

export default buttonConfigSchema;
