import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import type {
  GridConfig,
  WidgetInstance,
} from '../../../src/types';
import { DEFAULT_GRID_CONFIG } from '../constants';
import {
  convertFromGridLayout,
  convertToGridLayout,
  getBreakpointConfig,
} from '../utils/gridHelpers';

export interface UseGridOptions {
  widgets: WidgetInstance[];
  gridConfig?: GridConfig;
  onLayoutChange?: (widgets: WidgetInstance[]) => void;
}

const getDefaultBreakpoint = (config: GridConfig) =>
  config.breakpoints.find((bp) => bp.name === 'desktop')?.name ??
  config.breakpoints[0]?.name ??
  'desktop';

const buildLayouts = (config: GridConfig, widgets: WidgetInstance[]): Layouts =>
  config.breakpoints.reduce<Layouts>((acc, breakpoint) => {
    acc[breakpoint.name] = convertToGridLayout(
      widgets,
      breakpoint.name,
      config,
    );
    return acc;
  }, {});

export function useGrid({
  widgets,
  gridConfig = DEFAULT_GRID_CONFIG,
  onLayoutChange,
}: UseGridOptions) {
  const widgetsRef = useRef(widgets);
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const defaultBreakpointName = useMemo(
    () => getDefaultBreakpoint(gridConfig),
    [gridConfig],
  );

  const [layouts, setLayouts] = useState<Layouts>(() =>
    buildLayouts(gridConfig, widgets),
  );

  const [currentBreakpoint, setCurrentBreakpoint] = useState(
    defaultBreakpointName,
  );

  const currentBreakpointRef = useRef(currentBreakpoint);
  useEffect(() => {
    currentBreakpointRef.current = currentBreakpoint;
  }, [currentBreakpoint]);

  useEffect(() => {
    setLayouts(buildLayouts(gridConfig, widgets));
    setCurrentBreakpoint(defaultBreakpointName);
  }, [defaultBreakpointName, gridConfig, widgets]);

  const convertWidgetsToLayout = useCallback(
    (breakpoint: string) =>
      convertToGridLayout(widgetsRef.current, breakpoint, gridConfig),
    [gridConfig],
  );

  const convertLayoutToWidgets = useCallback(
    (layout: Layout[], breakpoint: string) =>
      convertFromGridLayout(
        layout,
        widgetsRef.current,
        breakpoint,
        gridConfig,
        defaultBreakpointName,
      ),
    [defaultBreakpointName, gridConfig],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout[], allLayouts: Layouts) => {
      setLayouts(allLayouts);
      if (!onLayoutChange) {
        return;
      }
      const breakpoint = currentBreakpointRef.current;
      const updatedWidgets = convertFromGridLayout(
        layout,
        widgetsRef.current,
        breakpoint,
        gridConfig,
        defaultBreakpointName,
      );
      onLayoutChange(updatedWidgets);
    },
    [defaultBreakpointName, gridConfig, onLayoutChange],
  );

  const handleBreakpointChange = useCallback(
    (breakpoint: string) => {
      setCurrentBreakpoint(breakpoint);
    },
    [],
  );

  const getResponsiveLayout = useCallback(
    (breakpoint: string) => layouts[breakpoint] ?? [],
    [layouts],
  );

  const updateResponsivePosition = useCallback(
    (widgetId: string, breakpoint: string, layout?: Layout[]) => {
      if (!onLayoutChange) {
        return;
      }
      const targetLayout =
        layout ?? layouts[breakpoint] ?? convertWidgetsToLayout(breakpoint);
      const widgetsFromLayout = convertFromGridLayout(
        targetLayout,
        widgetsRef.current,
        breakpoint,
        gridConfig,
        defaultBreakpointName,
      );

      if (widgetsFromLayout.some((widget) => widget.id === widgetId)) {
        onLayoutChange(widgetsFromLayout);
      }
    },
    [convertWidgetsToLayout, defaultBreakpointName, gridConfig, layouts, onLayoutChange],
  );

  const cols = useMemo(
    () =>
      gridConfig.breakpoints.reduce<Record<string, number>>((acc, breakpoint) => {
        const config = getBreakpointConfig(breakpoint.name, gridConfig);
        acc[breakpoint.name] = config?.columns ?? gridConfig.columns;
        return acc;
      }, {}),
    [gridConfig],
  );

  const breakpoints = useMemo(
    () =>
      gridConfig.breakpoints.reduce<Record<string, number>>((acc, breakpoint) => {
        acc[breakpoint.name] = breakpoint.minWidth;
        return acc;
      }, {}),
    [gridConfig],
  );

  return {
    layouts,
    currentBreakpoint,
    cols,
    breakpoints,
    convertWidgetsToLayout,
    convertLayoutToWidgets,
    handleLayoutChange,
    handleBreakpointChange,
    getResponsiveLayout,
    updateResponsivePosition,
  };
}

export type UseGridReturn = ReturnType<typeof useGrid>;
