import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type {
  GridPosition,
  PageLayout,
  WidgetConfig,
  WidgetInstance,
} from '../../../src/types';
import { DEFAULT_GRID_CONFIG, UNDO_HISTORY_LIMIT, WIDGET_DEFAULT_HEIGHT, WIDGET_DEFAULT_WIDTH } from '../constants';
import type { EditorMode, PageBuilderState } from '../types';
import {
  cloneWidget,
  createDefaultWidget,
  removeWidgetById,
  updateWidgetById,
  findWidgetById,
  autoPositionWidget,
  detectCollisions,
} from '../utils/layoutHelpers';
import { isPositionValid } from '../utils/gridHelpers';

export interface UsePageBuilderOptions {
  initialLayout?: PageLayout;
}

type Action =
  | { type: 'LOAD_LAYOUT'; payload: PageLayout }
  | { type: 'ADD_WIDGET'; payload: { type: string; position?: GridPosition } }
  | { type: 'UPDATE_WIDGET'; payload: { id: string; config: WidgetConfig } }
  | { type: 'REMOVE_WIDGET'; payload: { id: string } }
  | { type: 'SET_WIDGETS'; payload: { widgets: WidgetInstance[] } }
  | { type: 'SELECT_WIDGET'; payload: { id: string | null } }
  | { type: 'UPDATE_POSITION'; payload: { id: string; position: Partial<GridPosition> } }
  | { type: 'TOGGLE_LOCK'; payload: { id: string; locked: boolean } }
  | { type: 'DUPLICATE_WIDGET'; payload: { id: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_MODE'; payload: { mode: EditorMode } }
  | { type: 'RESET_LAYOUT' }
  | { type: 'SET_DIRTY'; payload: { isDirty: boolean } };

interface InternalState extends PageBuilderState {}

const initialLayout: PageLayout = {
  version: '1.0',
  grid: DEFAULT_GRID_CONFIG,
  widgets: [],
};

function cloneLayout(layout: PageLayout): PageLayout {
  return JSON.parse(JSON.stringify(layout));
}

function pushHistory(
  history: PageBuilderState['history'],
  snapshot: PageLayout,
): PageBuilderState['history'] {
  const past = [...history.past, snapshot];
  if (past.length > UNDO_HISTORY_LIMIT) {
    past.shift();
  }
  return {
    past,
    future: [],
  };
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'LOAD_LAYOUT': {
      return {
        ...state,
        layout: cloneLayout(action.payload),
        history: { past: [], future: [] },
        isDirty: false,
        selectedWidget: null,
      };
    }
    case 'ADD_WIDGET': {
      const snapshot = cloneLayout(state.layout);
      const requestedPosition = action.payload.position;
      const width = requestedPosition?.width ?? WIDGET_DEFAULT_WIDTH;
      const height = requestedPosition?.height ?? WIDGET_DEFAULT_HEIGHT;

      let resolvedPosition =
        requestedPosition && isPositionValid(requestedPosition, state.layout.grid)
          ? requestedPosition
          : autoPositionWidget(state.layout.widgets, width, height);

      let newWidget = createDefaultWidget(
        action.payload.type,
        resolvedPosition,
      );

      if (!isPositionValid(newWidget.position, state.layout.grid)) {
        resolvedPosition = autoPositionWidget(
          state.layout.widgets,
          width,
          height,
        );
        newWidget = createDefaultWidget(action.payload.type, resolvedPosition);
      }

      const collisions = detectCollisions(state.layout.widgets, newWidget);
      if (collisions.length) {
        const safePosition = autoPositionWidget(
          state.layout.widgets,
          newWidget.position.width,
          newWidget.position.height,
        );
        newWidget = createDefaultWidget(action.payload.type, safePosition);
      }

      const nextLayout: PageLayout = {
        ...state.layout,
        widgets: [...state.layout.widgets, newWidget],
      };

      return {
        ...state,
        layout: nextLayout,
        selectedWidget: newWidget,
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'UPDATE_WIDGET': {
      const snapshot = cloneLayout(state.layout);
      const widgets = updateWidgetById(
        state.layout.widgets,
        action.payload.id,
        (widget) => ({
          ...widget,
          config: {
            ...widget.config,
            ...action.payload.config,
          },
        }),
      );

      return {
        ...state,
        layout: { ...state.layout, widgets },
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'REMOVE_WIDGET': {
      const snapshot = cloneLayout(state.layout);
      const widgets = removeWidgetById(state.layout.widgets, action.payload.id);
      return {
        ...state,
        layout: { ...state.layout, widgets },
        history: pushHistory(state.history, snapshot),
        selectedWidget:
          state.selectedWidget?.id === action.payload.id
            ? null
            : state.selectedWidget,
        isDirty: true,
      };
    }
    case 'SET_WIDGETS': {
      const snapshot = cloneLayout(state.layout);
      return {
        ...state,
        layout: { ...state.layout, widgets: action.payload.widgets },
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'SELECT_WIDGET': {
      if (!action.payload.id) {
        return {
          ...state,
          selectedWidget: null,
        };
      }

      const widget = findWidgetById(state.layout.widgets, action.payload.id);
      return {
        ...state,
        selectedWidget: widget ?? null,
      };
    }
    case 'UPDATE_POSITION': {
      const snapshot = cloneLayout(state.layout);
      const widgets = updateWidgetById(
        state.layout.widgets,
        action.payload.id,
        (widget) => ({
          ...widget,
          position: {
            ...widget.position,
            ...action.payload.position,
          },
        }),
      );

      return {
        ...state,
        layout: { ...state.layout, widgets },
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'TOGGLE_LOCK': {
      const snapshot = cloneLayout(state.layout);
      const widgets = state.layout.widgets.map((widget) =>
        widget.id === action.payload.id
          ? { ...widget, isLocked: action.payload.locked }
          : widget,
      );
      return {
        ...state,
        layout: { ...state.layout, widgets },
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'DUPLICATE_WIDGET': {
      const snapshot = cloneLayout(state.layout);
      const original = findWidgetById(state.layout.widgets, action.payload.id);
      if (!original) {
        return state;
      }
      const duplicated = cloneWidget(original);
      const widgets = [...state.layout.widgets, duplicated];
      return {
        ...state,
        layout: { ...state.layout, widgets },
        selectedWidget: duplicated,
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'UNDO': {
      const past = [...state.history.past];
      if (!past.length) {
        return state;
      }
      const previous = past.pop()!;
      return {
        ...state,
        layout: previous,
        history: {
          past,
          future: [cloneLayout(state.layout), ...state.history.future],
        },
        isDirty: true,
      };
    }
    case 'REDO': {
      const future = [...state.history.future];
      if (!future.length) {
        return state;
      }
      const next = future.shift()!;
      return {
        ...state,
        layout: next,
        history: {
          past: [...state.history.past, cloneLayout(state.layout)],
          future,
        },
        isDirty: true,
      };
    }
    case 'SET_MODE':
      return {
        ...state,
        editorMode: action.payload.mode,
      };
    case 'RESET_LAYOUT': {
      const snapshot = cloneLayout(state.layout);
      const next: PageLayout = {
        ...state.layout,
        widgets: [],
      };
      return {
        ...state,
        layout: next,
        selectedWidget: null,
        history: pushHistory(state.history, snapshot),
        isDirty: true,
      };
    }
    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload.isDirty };
    default:
      return state;
  }
}

export function usePageBuilder(
  options: UsePageBuilderOptions = {},
) {
  const [state, dispatch] = useReducer(reducer, {
    layout: options.initialLayout ?? initialLayout,
    selectedWidget: null,
    editorMode: 'edit' as EditorMode,
    history: { past: [], future: [] },
    isDirty: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (options.initialLayout) {
      dispatch({ type: 'LOAD_LAYOUT', payload: options.initialLayout });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addWidget = useCallback(
    (type: string, position?: GridPosition) => {
      dispatch({ type: 'ADD_WIDGET', payload: { type, position } });
    },
    [],
  );

  const updateWidget = useCallback((id: string, config: WidgetConfig) => {
    dispatch({ type: 'UPDATE_WIDGET', payload: { id, config } });
  }, []);

  const removeWidget = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_WIDGET', payload: { id } });
  }, []);

  const selectWidget = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_WIDGET', payload: { id } });
  }, []);

  const updateWidgetPosition = useCallback(
    (id: string, position: Partial<GridPosition>) => {
      dispatch({ type: 'UPDATE_POSITION', payload: { id, position } });
    },
    [],
  );

  const setWidgetsFromLayout = useCallback((widgets: WidgetInstance[]) => {
    dispatch({ type: 'SET_WIDGETS', payload: { widgets } });
  }, []);

  const toggleWidgetLock = useCallback((id: string, locked: boolean) => {
    dispatch({ type: 'TOGGLE_LOCK', payload: { id, locked } });
  }, []);

  const duplicateWidget = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_WIDGET', payload: { id } });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const setEditorMode = useCallback((mode: EditorMode) => {
    dispatch({ type: 'SET_MODE', payload: { mode } });
  }, []);

  const resetLayout = useCallback(() => {
    dispatch({ type: 'RESET_LAYOUT' });
  }, []);

  const loadLayout = useCallback((layout: PageLayout) => {
    dispatch({ type: 'LOAD_LAYOUT', payload: layout });
  }, []);

  const stateValue = useMemo(
    () => ({
      ...state,
      addWidget,
      updateWidget,
      removeWidget,
      selectWidget,
      updateWidgetPosition,
      duplicateWidget,
      toggleWidgetLock,
      setWidgetsFromLayout,
      undo,
      redo,
      setEditorMode,
      resetLayout,
      loadLayout,
    }),
    [
      state,
      addWidget,
      updateWidget,
      removeWidget,
      selectWidget,
      updateWidgetPosition,
      duplicateWidget,
      toggleWidgetLock,
      setWidgetsFromLayout,
      undo,
      redo,
      setEditorMode,
      resetLayout,
      loadLayout,
    ],
  );

  return stateValue;
}

export type UsePageBuilderReturn = ReturnType<typeof usePageBuilder>;
