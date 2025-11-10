import Joi from 'joi';
import { FormConfig } from './types';

export const formConfigSchema = Joi.object({
  fields: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('text', 'email', 'tel', 'textarea', 'select', 'checkbox').required(),
      label: Joi.string().min(1).max(100).required(),
      placeholder: Joi.string().max(100).optional(),
      required: Joi.boolean().default(false),
      options: Joi.array().items(Joi.string()).optional()
    })
  ).min(1).max(20).required(),
  submitButtonText: Joi.string().min(1).max(50).default('Submit'),
  submitButtonColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#007bff'),
  action: Joi.string().uri().required().description('Form submission URL'),
  method: Joi.string().valid('POST', 'GET').default('POST')
});

export const formDefaults: FormConfig = {
  fields: [
    { id: '1', type: 'text', label: 'Name', placeholder: 'Your name', required: true },
    { id: '2', type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
    { id: '3', type: 'textarea', label: 'Message', placeholder: 'Your message', required: true }
  ],
  submitButtonText: 'Submit',
  submitButtonColor: '#007bff',
  action: '/api/forms/submit',
  method: 'POST'
};

export default formConfigSchema;
