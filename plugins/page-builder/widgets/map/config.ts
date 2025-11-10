import Joi from 'joi';
import { MapConfig } from './types';

export const mapConfigSchema = Joi.object({
  address: Joi.string().min(1).max(500).required().description('Address or place name'),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  zoom: Joi.number().min(1).max(20).default(14).description('Map zoom level'),
  height: Joi.number().min(200).max(1000).default(400).description('Map height in pixels'),
  mapType: Joi.string().valid('roadmap', 'satellite', 'hybrid', 'terrain').default('roadmap'),
  showMarker: Joi.boolean().default(true)
});

export const mapDefaults: MapConfig = {
  address: 'San Francisco, CA',
  zoom: 14,
  height: 400,
  mapType: 'roadmap',
  showMarker: true
};

export default mapConfigSchema;
