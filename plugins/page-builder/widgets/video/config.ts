import Joi from 'joi';
import { VideoConfig } from './types';

export const videoConfigSchema = Joi.object({
  url: Joi.string().uri().required().description('Video URL or embed code'),
  source: Joi.string().valid('youtube', 'vimeo', 'direct').default('youtube'),
  width: Joi.number().min(1).max(100).default(100).description('Width as percentage'),
  aspectRatio: Joi.string().valid('16:9', '4:3', '1:1', '21:9').default('16:9'),
  autoplay: Joi.boolean().default(false),
  controls: Joi.boolean().default(true),
  muted: Joi.boolean().default(false),
  loop: Joi.boolean().default(false),
  alignment: Joi.string().valid('left', 'center', 'right').default('center')
});

export const videoDefaults: VideoConfig = {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  source: 'youtube',
  width: 100,
  aspectRatio: '16:9',
  autoplay: false,
  controls: true,
  muted: false,
  loop: false,
  alignment: 'center'
};

export default videoConfigSchema;
