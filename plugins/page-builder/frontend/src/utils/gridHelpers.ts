import type { Layout } from 'react-grid-layout';
import type {
  GridConfig,
  GridPosition,
  WidgetInstance,
} from '../../../src/types';
import { DEFAULT_GRID_CONFIG } from '../constants';

export function convertToGridLayout(
  widgets: WidgetInstance[],
  breakpoint?: string,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
): Layout[] {
  return widgets.map((widget) => {
    const position = getResponsivePosition(widget.position, breakpoint);
    return {
      i: widget.id,
      x: Math.min(position.x, gridConfig.columns - position.width),
      y: position.y,
      w: position.width,
      h: position.height,
      isDraggable: !widget.isLocked,
      isResizable: !widget.isLocked,
    };
  });
}

function getResponsivePosition(
  position: GridPosition,
  breakpoint?: string,
): GridPosition {
  if (!breakpoint || !position.responsive?.length) {
    return position;
  }

  const responsive = position.responsive.find(
    (entry) => entry.breakpoint === breakpoint,
  );
  if (!responsive) {
    return position;
  }
  return {
    x: responsive.x,
    y: responsive.y,
    width: responsive.width,
    height: responsive.height,
    responsive: position.responsive,
    zIndex: position.zIndex,
  };
}

export function convertFromGridLayout(
  layout: Layout[],
  widgets: WidgetInstance[],
  breakpoint?: string,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
  baseBreakpoint?: string,
): WidgetInstance[] {
  const primaryBreakpoint =
    baseBreakpoint ??
    gridConfig.breakpoints[0]?.name ??
    'desktop';

  return widgets.map((widget) => {
    const gridItem = layout.find((item) => item.i === widget.id);
    if (!gridItem) {
      return widget;
    }

    if (!breakpoint || breakpoint === primaryBreakpoint) {
      return {
        ...widget,
        position: {
          ...widget.position,
          x: gridItem.x,
          y: gridItem.y,
          width: gridItem.w,
          height: gridItem.h,
        },
      };
    }

    const responsive = widget.position.responsive ?? [];
    const entryIndex = responsive.findIndex(
      (item) => item.breakpoint === breakpoint,
    );
    const updatedEntry = {
      breakpoint,
      x: gridItem.x,
      y: gridItem.y,
      width: gridItem.w,
      height: gridItem.h,
    };

    const updatedResponsive = [...responsive];
    if (entryIndex >= 0) {
      updatedResponsive[entryIndex] = updatedEntry;
    } else {
      updatedResponsive.push(updatedEntry);
    }

    return {
      ...widget,
      position: {
        ...widget.position,
        responsive: updatedResponsive,
      },
    };
  });
}

export function getBreakpointConfig(
  breakpoint: string,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
) {
  return (
    gridConfig.breakpoints.find((bp) => bp.name === breakpoint) ??
    gridConfig.breakpoints[0]
  );
}

export function calculateResponsivePosition(
  position: GridPosition,
  fromBreakpoint: string,
  toBreakpoint: string,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
): GridPosition {
  const fromConfig = getBreakpointConfig(fromBreakpoint, gridConfig);
  const toConfig = getBreakpointConfig(toBreakpoint, gridConfig);
  const ratio = (toConfig?.columns ?? gridConfig.columns) /
    (fromConfig?.columns ?? gridConfig.columns);
  let x = Math.round(position.x * ratio);
  let width = Math.max(1, Math.round(position.width * ratio));
  const maxCols = toConfig?.columns ?? gridConfig.columns;
  if (x + width > maxCols) {
    x = Math.max(0, maxCols - width);
  }
  return {
    ...position,
    x,
    width,
  };
}

export function snapToGrid(
  value: number,
  gridSize: number,
): number {
  if (gridSize <= 0) {
    return value;
  }
  return Math.round(value / gridSize) * gridSize;
}

export function isPositionValid(
  position: GridPosition,
  gridConfig: GridConfig = DEFAULT_GRID_CONFIG,
): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + position.width <= gridConfig.columns &&
    position.width > 0 &&
    position.height > 0
  );
}

export function getGridCellSize(
  containerWidth: number,
  cols: number,
  gap: number,
): number {
  const totalGap = gap * (cols - 1);
  const availableWidth = containerWidth - totalGap;
  return availableWidth / cols;
}

export function pixelsToGridUnits(
  pixels: number,
  cellSize: number,
): number {
  return Math.round(pixels / cellSize);
}

export function gridUnitsToPixels(
  units: number,
  cellSize: number,
): number {
  return Math.round(units * cellSize);
}

export function optimizeLayout(layout: Layout[]): Layout[] {
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Layout[] = [];
  const highestRow = sorted.reduce(
    (acc, item) => Math.max(acc, item.y + item.h),
    0,
  );
  const maxRowLimit = highestRow + 100;

  sorted.forEach((item) => {
    let y = item.y;
    while (
      placed.some(
        (placedItem) =>
          placedItem.x < item.x + item.w &&
          placedItem.x + placedItem.w > item.x &&
          placedItem.y < y + item.h &&
          placedItem.y + placedItem.h > y,
      )
    ) {
      y += 1;
      if (y > maxRowLimit) {
        console.warn('optimizeLayout: reached maximum row limit while placing item', item);
        y = maxRowLimit;
        break;
      }
    }
    placed.push({ ...item, y });
  });

  return placed;
}

export function detectLayoutCollisions(layout: Layout[]): Layout[] {
  const collisions: Layout[] = [];
  const seen = new Set<string>();

  const makeKey = (item: Layout) =>
    item.i ?? `${item.x}-${item.y}-${item.w}-${item.h}`;

  const pushUnique = (item: Layout) => {
    const key = makeKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      collisions.push(item);
    }
  };

  layout.forEach((item, index) => {
    for (let i = index + 1; i < layout.length; i += 1) {
      const other = layout[i];
      const overlapping =
        item.x < other.x + other.w &&
        item.x + item.w > other.x &&
        item.y < other.y + other.h &&
        item.y + item.h > other.y;
      if (overlapping) {
        pushUnique(item);
        pushUnique(other);
      }
    }
  });
  return collisions;
}

export function resolveCollisions(layout: Layout[]): Layout[] {
  const resolved = [...layout];
  const seen = new Set<string>();

  for (let i = 0; i < resolved.length; i += 1) {
    let item = resolved[i];
    while (
      detectLayoutCollisions(resolved).some(
        (collision) => collision.i === item.i && !seen.has(collision.i),
      )
    ) {
      item = { ...item, y: item.y + 1 };
      resolved[i] = item;
    }
    seen.add(item.i);
  }

  return resolved;
}
