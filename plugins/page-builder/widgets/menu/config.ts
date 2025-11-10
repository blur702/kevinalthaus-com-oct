import Joi from 'joi';
import type { MenuWidgetConfig } from './types';

export const menuWidgetSchema = Joi.object<MenuWidgetConfig>({
  menuSlug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).default('main-navigation'),
  orientation: Joi.string().valid('horizontal', 'vertical').default('horizontal'),
  variant: Joi.string().valid('links', 'buttons').default('links'),
  alignment: Joi.string().valid('left', 'center', 'right').default('left'),
  showIcons: Joi.boolean().default(false),
  showDescriptions: Joi.boolean().default(false),
});

export const menuWidgetDefaults: MenuWidgetConfig = {
  menuSlug: 'main-navigation',
  orientation: 'horizontal',
  variant: 'links',
  alignment: 'left',
  showIcons: false,
  showDescriptions: false,
};

export default menuWidgetSchema;
