import { useCallback, useMemo, useState } from 'react';
import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useDndMonitor,
} from '@dnd-kit/core';
import type { GridPosition } from '../../../src/types';
import type { DragItem } from '../types';

export interface UseDragDropOptions {
  onWidgetAdd?: (type: string, position: GridPosition) => void;
  onWidgetMove?: (id: string, position: GridPosition) => void;
}

type DragState = {
  activeId: string | null;
  overId: string | null;
  dragItem: DragItem | null;
};

const defaultPosition: GridPosition = {
  x: 0,
  y: 0,
  width: 4,
  height: 2,
};

export function useDragDrop(options: UseDragDropOptions = {}) {
  const [dragState, setDragState] = useState<DragState>({
    activeId: null,
    overId: null,
    dragItem: null,
  });

  const getPositionFromEvent = useCallback(
    (event: DragOverEvent | DragEndEvent): GridPosition => {
      const gridPosition = event.over?.data?.current?.gridPosition as
        | GridPosition
        | undefined;
      if (gridPosition) {
        return gridPosition;
      }
      const x = event.over?.data?.current?.x ?? 0;
      const y = event.over?.data?.current?.y ?? 0;
      return { ...defaultPosition, x, y };
    },
    [],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = event.active.data.current as DragItem | undefined;
    setDragState({
      activeId: event.active.id?.toString() ?? null,
      overId: null,
      dragItem: item ?? null,
    });
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      setDragState((prev) => ({
        ...prev,
        overId: event.over?.id?.toString() ?? null,
      }));
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragState({
        activeId: null,
        overId: null,
        dragItem: null,
      });

      const item = event.active.data.current as DragItem | undefined;
      if (!item) {
        return;
      }

      const position = getPositionFromEvent(event);
      if (item.metadata?.source === 'palette' && item.widgetType) {
        options.onWidgetAdd?.(item.widgetType, position);
      } else if (item.id) {
        options.onWidgetMove?.(item.id, position);
      }
    },
    [getPositionFromEvent, options],
  );

  const handleDragCancel = useCallback(() => {
    setDragState({
      activeId: null,
      overId: null,
      dragItem: null,
    });
  }, []);

  useDndMonitor({
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  });

  const helpers = useMemo(
    () => ({
      isDragging: (id: string) => dragState.activeId === id,
      isOver: (id: string) => dragState.overId === id,
    }),
    [dragState.activeId, dragState.overId],
  );

  return {
    activeId: dragState.activeId,
    overId: dragState.overId,
    dragItem: dragState.dragItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    ...helpers,
  };
}

export type UseDragDropReturn = ReturnType<typeof useDragDrop>;
