import Joi from 'joi';
import { TabsConfig } from './types';

export const tabsConfigSchema = Joi.object({
  tabs: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      title: Joi.string().min(1).max(100).required(),
      content: Joi.string().min(0).max(10000).required()
    })
  ).min(1).max(10).required(),
  activeTabBackgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#007bff'),
  inactiveTabBackgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#e0e0e0'),
  tabTextColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#ffffff')
});

export const tabsDefaults: TabsConfig = {
  tabs: [
    { id: '1', title: 'Tab 1', content: 'Content for tab 1' },
    { id: '2', title: 'Tab 2', content: 'Content for tab 2' }
  ],
  activeTabBackgroundColor: '#007bff',
  inactiveTabBackgroundColor: '#e0e0e0',
  tabTextColor: '#ffffff'
};

export default tabsConfigSchema;
