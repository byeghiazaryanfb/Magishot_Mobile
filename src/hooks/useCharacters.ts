import {useState, useEffect, useCallback, useMemo} from 'react';
import {
  CharacterItem,
  CharacterCategory,
  HierarchicalResponse,
  fetchCharactersHierarchical,
  getAllCharactersFromHierarchy,
  getCharactersByCategoryId,
  searchCharactersInList,
} from '../services/charactersApi';

interface UseCharactersResult {
  categories: CharacterCategory[];
  allCharacters: CharacterItem[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => Promise<void>;
  getCharactersByCategory: (categoryId: string) => CharacterItem[];
  getCharactersBySubcategory: (categoryId: string, subcategoryId: string) => CharacterItem[];
  searchCharacters: (query: string) => CharacterItem[];
}

export const useCharacters = (): UseCharactersResult => {
  const [data, setData] = useState<HierarchicalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchCharactersHierarchical();
      setData(response);
    } catch (err) {
      console.error('Failed to fetch characters:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch characters');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extract all characters from hierarchy
  const allCharacters = useMemo(() => {
    if (!data?.categories) return [];
    return getAllCharactersFromHierarchy(data.categories);
  }, [data]);

  // Get characters by main category (e.g., 'celebrities')
  const getCharactersByCategory = useCallback(
    (categoryId: string): CharacterItem[] => {
      if (!data?.categories) return [];
      return getCharactersByCategoryId(data.categories, categoryId);
    },
    [data]
  );

  // Get characters by subcategory (e.g., 'actors' within 'celebrities')
  const getCharactersBySubcategory = useCallback(
    (categoryId: string, subcategoryId: string): CharacterItem[] => {
      if (!data?.categories) return [];

      // Find the main category
      const mainCategory = data.categories.find(c => c.categoryId === categoryId);
      if (!mainCategory?.children) return [];

      // Find the subcategory
      const subCategory = mainCategory.children.find(c => c.categoryId === subcategoryId);
      if (!subCategory) return [];

      // Return characters from subcategory
      const characters: CharacterItem[] = [];
      if (subCategory.characters) {
        characters.push(...subCategory.characters);
      }
      // Also include from deeper children if any
      const extractDeep = (cat: CharacterCategory) => {
        if (cat.characters) characters.push(...cat.characters);
        if (cat.children) {
          for (const child of cat.children) {
            extractDeep(child);
          }
        }
      };
      if (subCategory.children) {
        for (const child of subCategory.children) {
          extractDeep(child);
        }
      }

      return characters;
    },
    [data]
  );

  // Search characters
  const searchCharacters = useCallback(
    (query: string): CharacterItem[] => {
      return searchCharactersInList(allCharacters, query);
    },
    [allCharacters]
  );

  return {
    categories: data?.categories || [],
    allCharacters,
    isLoading,
    error,
    totalCount: data?.totalCount || 0,
    refetch: fetchData,
    getCharactersByCategory,
    getCharactersBySubcategory,
    searchCharacters,
  };
};
