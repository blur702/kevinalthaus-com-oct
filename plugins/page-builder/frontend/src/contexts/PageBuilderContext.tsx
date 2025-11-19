import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PageLayout, WidgetRegistryEntry } from '../../../src/types';
import { usePageBuilder } from '../hooks/usePageBuilder';
import type { UsePageBuilderReturn } from '../hooks/usePageBuilder';
import { fetchWidgets } from '../services/pageBuilderApi';

export interface PageBuilderContextType {
  editor: UsePageBuilderReturn;
  widgets: WidgetRegistryEntry[];
  isLoading: boolean;
  error: string | null;
  refreshWidgets: () => Promise<void>;
}

const PageBuilderContext = createContext<PageBuilderContextType | undefined>(
  undefined,
);

export interface PageBuilderProviderProps {
  initialLayout?: PageLayout;
  children: ReactNode;
}

export function PageBuilderProvider({
  initialLayout,
  children,
}: PageBuilderProviderProps) {
  const editor = usePageBuilder({ initialLayout });
  const [widgets, setWidgets] = useState<WidgetRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWidgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchWidgets();
      setWidgets(response.data?.widgets ?? []);
      setError(null);
    } catch (err) {
      console.error('Failed to load widget registry', err);
      setError('Unable to load widgets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWidgets();
  }, [refreshWidgets]);

  const value = useMemo<PageBuilderContextType>(
    () => ({
      editor,
      widgets,
      isLoading,
      error,
      refreshWidgets,
    }),
    [editor, widgets, isLoading, error, refreshWidgets],
  );

  return (
    <PageBuilderContext.Provider value={value}>
      {children}
    </PageBuilderContext.Provider>
  );
}

export function usePageBuilderContext(): PageBuilderContextType {
  const context = useContext(PageBuilderContext);
  if (!context) {
    throw new Error(
      'usePageBuilderContext must be used within a PageBuilderProvider',
    );
  }
  return context;
}

export default PageBuilderContext;
