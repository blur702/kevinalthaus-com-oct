import Joi from 'joi';
import { ImageConfig } from './types';

export const imageConfigSchema = Joi.object({
  src: Joi.string().uri().required().description('Image URL'),
  alt: Joi.string().trim().min(1).max(500).required().description('Alternative text for accessibility'),
  caption: Joi.string().min(0).max(500).optional().description('Image caption'),
  width: Joi.number().min(50).max(2000).default(800),
  height: Joi.number().min(50).max(2000).optional(),
  objectFit: Joi.string().valid('contain', 'cover', 'fill', 'none', 'scale-down').default('cover'),
  alignment: Joi.string().valid('left', 'center', 'right').default('center'),
  borderRadius: Joi.number().min(0).max(100).default(0),
  linkUrl: Joi.string().uri().optional().description('Optional link URL'),
  openInNewTab: Joi.boolean().default(false)
});

export const imageDefaults: ImageConfig = {
  src: 'https://via.placeholder.com/800x600',
  alt: 'Placeholder image',
  width: 800,
  objectFit: 'cover',
  alignment: 'center',
  borderRadius: 0,
  openInNewTab: false
};

export default imageConfigSchema;
