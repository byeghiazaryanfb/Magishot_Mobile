import {useState, useEffect, useCallback} from 'react';
import {ActionItem, fetchActionsFromApi} from '../services/actionsApi';

interface UseActionsResult {
  actions: ActionItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useActions = (): UseActionsResult => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiActions = await fetchActionsFromApi();
      setActions(apiActions);
    } catch (err) {
      console.error('Failed to fetch actions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch actions');
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return {
    actions,
    isLoading,
    error,
    refetch: fetchActions,
  };
};
