import Joi from 'joi';
import { AccordionConfig } from './types';

export const accordionConfigSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      title: Joi.string().min(1).max(200).required(),
      content: Joi.string().min(0).max(10000).required(),
      isExpanded: Joi.boolean().default(false)
    })
  ).min(1).max(20).required(),
  allowMultiple: Joi.boolean().default(false).description('Allow multiple panels open simultaneously'),
  borderColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#e0e0e0'),
  headerBackgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#f5f5f5'),
  headerTextColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#333333')
});

export const accordionDefaults: AccordionConfig = {
  items: [
    {
      id: '1',
      title: 'Section 1',
      content: 'Content for section 1',
      isExpanded: false
    },
    {
      id: '2',
      title: 'Section 2',
      content: 'Content for section 2',
      isExpanded: false
    }
  ],
  allowMultiple: false,
  borderColor: '#e0e0e0',
  headerBackgroundColor: '#f5f5f5',
  headerTextColor: '#333333'
};

export default accordionConfigSchema;
