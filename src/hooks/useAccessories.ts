import {useState, useEffect, useCallback} from 'react';
import {AccessoryItem, fetchAccessoriesFromApi} from '../services/accessoriesApi';

interface UseAccessoriesResult {
  accessories: AccessoryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAccessories = (): UseAccessoriesResult => {
  const [accessories, setAccessories] = useState<AccessoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccessories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiAccessories = await fetchAccessoriesFromApi();
      setAccessories(apiAccessories);
    } catch (err) {
      console.error('Failed to fetch accessories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch accessories');
      setAccessories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessories();
  }, [fetchAccessories]);

  return {
    accessories,
    isLoading,
    error,
    refetch: fetchAccessories,
  };
};
