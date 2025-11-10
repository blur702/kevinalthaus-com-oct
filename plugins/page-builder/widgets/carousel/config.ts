import Joi from 'joi';
import { CarouselConfig } from './types';

export const carouselConfigSchema = Joi.object({
  slides: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      imageUrl: Joi.string().uri().required(),
      caption: Joi.string().max(200).optional(),
      alt: Joi.string().max(200).required()
    })
  ).min(1).max(50).required(),
  autoPlay: Joi.boolean().default(true),
  interval: Joi.number().min(1000).max(30000).default(5000).description('Interval in milliseconds'),
  showDots: Joi.boolean().default(true),
  showArrows: Joi.boolean().default(true),
  height: Joi.number().min(200).max(1000).default(400)
});

export const carouselDefaults: CarouselConfig = {
  slides: [
    {
      id: '1',
      imageUrl: 'https://placehold.co/800x400/007bff/ffffff?text=Slide%201',
      alt: 'Slide 1',
      caption: 'First slide'
    },
    {
      id: '2',
      imageUrl: 'https://placehold.co/800x400/28a745/ffffff?text=Slide%202',
      alt: 'Slide 2',
      caption: 'Second slide'
    }
  ],
  autoPlay: true,
  interval: 5000,
  showDots: true,
  showArrows: true,
  height: 400
};

export default carouselConfigSchema;
