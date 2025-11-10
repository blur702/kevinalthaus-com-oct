import Joi from 'joi';
import { CodeConfig } from './types';

export const codeConfigSchema = Joi.object({
  code: Joi.string().min(0).max(50000).required().description('Code content'),
  language: Joi.string().min(1).max(50).default('javascript').description('Programming language'),
  showLineNumbers: Joi.boolean().default(true),
  theme: Joi.string().valid('light', 'dark').default('light'),
  fontSize: Joi.number().min(10).max(24).default(14)
});

export const codeDefaults: CodeConfig = {
  code: 'console.log("Hello, World!");',
  language: 'javascript',
  showLineNumbers: true,
  theme: 'light',
  fontSize: 14
};

export default codeConfigSchema;
