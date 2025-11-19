import DOMPurify from 'dompurify';
import type {
  WidgetConfig,
  WidgetInstance,
  WidgetRegistryEntry,
} from '../../../src/types';
import type { LucideIcon } from 'lucide-react';
import {
  Blocks,
  Brush,
  Image as ImageIcon,
  LayoutPanelLeft,
  Puzzle,
  Rows,
  Square,
  Type,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  text: Type,
  heading: Rows,
  image: ImageIcon,
  button: Square,
  layout: LayoutPanelLeft,
  block: Blocks,
  puzzle: Puzzle,
  brush: Brush,
};

const DEFAULT_WIDGET_CONFIG: Record<string, WidgetConfig> = {
  'text-content': {
    text: '<p>Edit me</p>',
    alignment: 'left',
  },
  heading: {
    text: 'Heading',
    level: 'h2',
    alignment: 'left',
  },
  button: {
    label: 'Click me',
    href: '#',
    variant: 'contained',
  },
  image: {
    src: '',
    alt: 'Image description',
    objectFit: 'cover',
  },
  spacer: {
    height: 24,
  },
};

export function getWidgetIcon(iconName: string): LucideIcon {
  const normalized = iconName?.toLowerCase() ?? '';
  return ICON_MAP[normalized] ?? ICON_MAP[iconName] ?? Square;
}

export function getWidgetDefaultConfig(type: string): WidgetConfig {
  return DEFAULT_WIDGET_CONFIG[type] ?? {};
}

export function validateWidgetConfig(
  type: string,
  config: WidgetConfig,
  schema?: { validate?: (value: WidgetConfig) => { error?: { details: Array<{ message: string }> } } },
): { valid: boolean; errors?: string[] } {
  if (schema?.validate) {
    const { error } = schema.validate(config);
    if (error) {
      return {
        valid: false,
        errors: error.details.map((detail) => `${type}: ${detail.message}`),
      };
    }
  }
  return { valid: true };
}

export function sanitizeWidgetConfig(config: WidgetConfig): WidgetConfig {
  const sanitized: WidgetConfig = Array.isArray(config) ? [...config] : { ...config };

  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === 'string') {
      sanitized[key] = DOMPurify.sanitize(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeWidgetConfig(value as WidgetConfig);
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

export function serializeWidgetConfig(config: WidgetConfig): string {
  return JSON.stringify(config);
}

export function deserializeWidgetConfig(json: string): WidgetConfig {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse widget config', error);
    return {};
  }
}

export function getWidgetDisplayName(
  widget: WidgetInstance,
  registry: WidgetRegistryEntry[],
): string {
  const entry = registry.find((item) => item.type === widget.type);
  return entry?.displayName ?? entry?.name ?? widget.type;
}

export function isContainerWidget(
  type: string,
  registry: WidgetRegistryEntry[],
): boolean {
  return Boolean(registry.find((entry) => entry.type === type)?.isContainer);
}

export function getWidgetCategory(
  type: string,
  registry: WidgetRegistryEntry[],
): string | undefined {
  return registry.find((entry) => entry.type === type)?.category;
}

export function filterWidgetsByCategory(
  widgets: WidgetRegistryEntry[],
  category: string,
) {
  if (!category) {
    return widgets;
  }
  return widgets.filter(
    (widget) => widget.category?.toLowerCase() === category.toLowerCase(),
  );
}

export function searchWidgets(
  widgets: WidgetRegistryEntry[],
  query: string,
) {
  if (!query) {
    return widgets;
  }
  const normalized = query.toLowerCase();
  return widgets.filter((widget) => {
    return (
      widget.name.toLowerCase().includes(normalized) ||
      widget.displayName?.toLowerCase().includes(normalized) ||
      widget.description?.toLowerCase().includes(normalized) ||
      widget.tags?.some((tag) => tag.toLowerCase().includes(normalized))
    );
  });
}

export function sortWidgetsByName(
  widgets: WidgetRegistryEntry[],
) {
  return [...widgets].sort((a, b) =>
    (a.displayName || a.name).localeCompare(b.displayName || b.name),
  );
}
