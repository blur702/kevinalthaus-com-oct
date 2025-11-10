import Joi from 'joi';
import { SpacerConfig } from './types';

export const spacerConfigSchema = Joi.object({
  height: Joi.number().min(1).max(500).default(40).description('Spacer height in pixels')
});

export const spacerDefaults: SpacerConfig = {
  height: 40
};

export default spacerConfigSchema;
