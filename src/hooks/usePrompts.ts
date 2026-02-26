import {useState, useEffect, useCallback} from 'react';
import {Sight, SIGHTS, CATEGORIES, SightCategory} from '../constants/sights';
import {fetchPromptsFromApi, mergeSights} from '../services/promptsApi';

// Category type that supports both emoji icons and URL icons
export interface CategoryWithIcon {
  id: SightCategory | 'all';
  label: string;
  icon: string; // Can be emoji or URL
}

interface UsePromptsResult {
  sights: Sight[];
  categories: CategoryWithIcon[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isUsingApi: boolean;
}

// Convert local CATEGORIES to CategoryWithIcon format
const localCategoriesToCategoryWithIcon = (): CategoryWithIcon[] => {
  return CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: cat.icon,
  }));
};

export const usePrompts = (useApiPrompts: boolean = true): UsePromptsResult => {
  const [sights, setSights] = useState<Sight[]>(SIGHTS);
  const [categories, setCategories] = useState<CategoryWithIcon[]>(localCategoriesToCategoryWithIcon());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingApi, setIsUsingApi] = useState(false);

  const fetchPrompts = useCallback(async () => {
    if (!useApiPrompts) {
      setSights(SIGHTS);
      setCategories(localCategoriesToCategoryWithIcon());
      setIsUsingApi(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {sights: apiSights, categories: apiCategories} = await fetchPromptsFromApi();

      if (apiSights.length > 0) {
        // Merge API sights with local sights (API takes priority)
        const mergedSights = mergeSights(apiSights, SIGHTS);
        setSights(mergedSights);
        setIsUsingApi(true);

        // Use API categories if available, with 'all' category prepended
        if (apiCategories && apiCategories.length > 0) {
          const allCategory: CategoryWithIcon = {id: 'all', label: 'All', icon: '✨'};
          const mappedCategories: CategoryWithIcon[] = apiCategories.map(cat => {
            console.log(`[usePrompts] Mapping category: ${cat.name}, icon: "${cat.icon}"`);
            return {
              id: cat.id as SightCategory | 'all',
              label: cat.name,
              icon: cat.icon,
            };
          });
          console.log('[usePrompts] Final categories:', JSON.stringify([allCategory, ...mappedCategories], null, 2));
          setCategories([allCategory, ...mappedCategories]);
        }
      } else {
        // Fallback to local sights if API returns empty
        setSights(SIGHTS);
        setCategories(localCategoriesToCategoryWithIcon());
        setIsUsingApi(false);
      }
    } catch (err) {
      console.error('Failed to fetch prompts, using local sights:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prompts');
      // Fallback to local sights on error
      setSights(SIGHTS);
      setCategories(localCategoriesToCategoryWithIcon());
      setIsUsingApi(false);
    } finally {
      setIsLoading(false);
    }
  }, [useApiPrompts]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return {
    sights,
    categories,
    isLoading,
    error,
    refetch: fetchPrompts,
    isUsingApi,
  };
};
