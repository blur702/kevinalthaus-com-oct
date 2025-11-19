import { v4 as uuid } from 'uuid';
import type {
  GridPosition,
  PageLayout,
  WidgetConfig,
  WidgetInstance,
} from '../../../src/types';
import {
  SUPPORTED_LAYOUT_VERSIONS,
  WIDGET_DEFAULT_HEIGHT,
  WIDGET_DEFAULT_WIDTH,
} from '../constants';
import { getWidgetDefaultConfig } from './widgetHelpers';

type WidgetUpdater =
  | Partial<WidgetInstance>
  | ((widget: WidgetInstance) => WidgetInstance);

export function generateWidgetId(): string {
  return uuid();
}

export function createDefaultWidget(
  type: string,
  position: GridPosition,
): WidgetInstance {
  const config: WidgetConfig = getWidgetDefaultConfig(type);

  return {
    id: generateWidgetId(),
    type,
    position: {
      x: position.x ?? 0,
      y: position.y ?? 0,
      width: position.width ?? WIDGET_DEFAULT_WIDTH,
      height: position.height ?? WIDGET_DEFAULT_HEIGHT,
      responsive: position.responsive ?? [],
      zIndex: position.zIndex,
    },
    config,
    children: [],
  };
}

export function validateLayout(layout: PageLayout): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];
  if (!SUPPORTED_LAYOUT_VERSIONS.includes(layout.version as (typeof SUPPORTED_LAYOUT_VERSIONS)[number])) {
    errors.push(`Unsupported layout version '${layout.version}'`);
  }
  if (!layout.grid) {
    errors.push('Missing grid configuration');
  }
  if (!Array.isArray(layout.widgets)) {
    errors.push('Widgets must be an array');
  }
  return {
    valid: errors.length === 0,
    errors: errors.length ? errors : undefined,
  };
}

export function cloneWidget(widget: WidgetInstance): WidgetInstance {
  return {
    ...JSON.parse(JSON.stringify(widget)),
    id: generateWidgetId(),
    children: widget.children?.map(cloneWidget) ?? [],
  };
}

export function findWidgetById(
  widgets: WidgetInstance[],
  id: string,
): WidgetInstance | null {
  for (const widget of widgets) {
    if (widget.id === id) {
      return widget;
    }
    if (widget.children?.length) {
      const found = findWidgetById(widget.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function removeWidgetById(
  widgets: WidgetInstance[],
  id: string,
): WidgetInstance[] {
  return widgets
    .filter((widget) => widget.id !== id)
    .map((widget) => ({
      ...widget,
      children: widget.children
        ? removeWidgetById(widget.children, id)
        : widget.children,
    }));
}

export function updateWidgetById(
  widgets: WidgetInstance[],
  id: string,
  updates: WidgetUpdater,
): WidgetInstance[] {
  return widgets.map((widget) => {
    if (widget.id === id) {
      const updated =
        typeof updates === 'function'
          ? updates(widget)
          : { ...widget, ...updates };
      return {
        ...updated,
        children: updated.children ?? widget.children,
      };
    }

    if (widget.children?.length) {
      return {
        ...widget,
        children: updateWidgetById(widget.children, id, updates),
      };
    }

    return widget;
  });
}

export function getWidgetPath(
  widgets: WidgetInstance[],
  id: string,
  path: string[] = [],
): string[] {
  for (const widget of widgets) {
    if (widget.id === id) {
      return [...path, widget.id];
    }
    if (widget.children?.length) {
      const childPath = getWidgetPath(widget.children, id, [...path, widget.id]);
      if (childPath.length) {
        return childPath;
      }
    }
  }
  return [];
}

export function flattenWidgets(
  widgets: WidgetInstance[],
): WidgetInstance[] {
  return widgets.flatMap((widget) => [
    widget,
    ...(widget.children ? flattenWidgets(widget.children) : []),
  ]);
}

export function calculateGridBounds(widgets: WidgetInstance[]) {
  const bounds = widgets.reduce(
    (acc, widget) => {
      const { x, y, width, height } = widget.position;
      acc.width = Math.max(acc.width, x + width);
      acc.height = Math.max(acc.height, y + height);
      return acc;
    },
    { width: 0, height: 0 },
  );

  return bounds;
}

export function detectCollisions(
  widgets: WidgetInstance[],
  newWidget: WidgetInstance,
): WidgetInstance[] {
  const collisions: WidgetInstance[] = [];
  for (const widget of widgets) {
    if (widget.id === newWidget.id) {
      continue;
    }
    const overlaps =
      widget.position.x < newWidget.position.x + newWidget.position.width &&
      widget.position.x + widget.position.width > newWidget.position.x &&
      widget.position.y < newWidget.position.y + newWidget.position.height &&
      widget.position.y + widget.position.height > newWidget.position.y;

    if (overlaps) {
      collisions.push(widget);
    }
  }

  return collisions;
}

export function autoPositionWidget(
  widgets: WidgetInstance[],
  width = WIDGET_DEFAULT_WIDTH,
  height = WIDGET_DEFAULT_HEIGHT,
): GridPosition {
  if (!widgets.length) {
    return {
      x: 0,
      y: 0,
      width,
      height,
    };
  }

  const maxY = widgets.reduce(
    (acc, widget) => Math.max(acc, widget.position.y + widget.position.height),
    0,
  );

  return {
    x: 0,
    y: maxY,
    width,
    height,
  };
}

export function removeWidgetByIds(
  widgets: WidgetInstance[],
  ids: string[],
): WidgetInstance[] {
  return widgets
    .filter((widget) => !ids.includes(widget.id))
    .map((widget) => ({
      ...widget,
      children: widget.children
        ? removeWidgetByIds(widget.children, ids)
        : widget.children,
    }));
}
