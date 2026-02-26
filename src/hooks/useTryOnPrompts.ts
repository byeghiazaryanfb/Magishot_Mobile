import {useState, useEffect, useCallback} from 'react';
import {TryOnPromptItem, fetchTryOnPromptsFromApi} from '../services/tryOnPromptsApi';

interface UseTryOnPromptsResult {
  prompts: TryOnPromptItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useTryOnPrompts = (): UseTryOnPromptsResult => {
  const [prompts, setPrompts] = useState<TryOnPromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiPrompts = await fetchTryOnPromptsFromApi();
      setPrompts(apiPrompts);
    } catch (err) {
      console.error('Failed to fetch try-on prompts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch try-on prompts');
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return {
    prompts,
    isLoading,
    error,
    refetch: fetchPrompts,
  };
};
