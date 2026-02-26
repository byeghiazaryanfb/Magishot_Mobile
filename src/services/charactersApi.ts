import {config} from '../utils/config';

// Character from API
export interface CharacterItem {
  id: string;
  characterId: string;
  name: string;
  imageUrl: string;
  category: string;
  subcategory?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  estimatedCoins?: number;
  isFree?: boolean;
}

// Category from API
export interface CharacterCategory {
  id: string;
  categoryId: string;
  name: string;
  icon: string;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  children?: CharacterCategory[];
  characters?: CharacterItem[];
}

// Hierarchical response
export interface HierarchicalResponse {
  categories: CharacterCategory[];
  totalCount: number;
}

// Flat response
export interface CharactersResponse {
  characters: CharacterItem[];
  totalCount: number;
}

// Helper to get full image URL from relative path
export const getFullCharacterImageUrl = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  // Prepend API base URL for relative paths
  return `${config.apiBaseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
};

/**
 * Fetch all characters (flat list)
 */
export const fetchCharactersFlat = async (): Promise<CharacterItem[]> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/Characters`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }

    const data: CharactersResponse = await response.json();
    return data.characters || [];
  } catch (error) {
    console.error('Error fetching characters:', error);
    throw error;
  }
};

/**
 * Fetch characters with hierarchical structure (categories + characters)
 */
export const fetchCharactersHierarchical = async (): Promise<HierarchicalResponse> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/Characters/hierarchical`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }

    const data: HierarchicalResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching characters hierarchical:', error);
    throw error;
  }
};

/**
 * Fetch categories only
 */
export const fetchCharacterCategories = async (): Promise<CharacterCategory[]> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/Characters/categories`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }

    const data: CharacterCategory[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// Helper functions for working with hierarchical data
export const getAllCharactersFromHierarchy = (categories: CharacterCategory[]): CharacterItem[] => {
  const characters: CharacterItem[] = [];

  const extractCharacters = (cats: CharacterCategory[]) => {
    for (const cat of cats) {
      if (cat.characters && cat.characters.length > 0) {
        characters.push(...cat.characters);
      }
      if (cat.children && cat.children.length > 0) {
        extractCharacters(cat.children);
      }
    }
  };

  extractCharacters(categories);
  return characters;
};

export const getCharactersByCategoryId = (
  categories: CharacterCategory[],
  categoryId: string
): CharacterItem[] => {
  const characters: CharacterItem[] = [];

  const findCategory = (cats: CharacterCategory[]): CharacterCategory | null => {
    for (const cat of cats) {
      if (cat.categoryId === categoryId) {
        return cat;
      }
      if (cat.children && cat.children.length > 0) {
        const found = findCategory(cat.children);
        if (found) return found;
      }
    }
    return null;
  };

  const category = findCategory(categories);
  if (category) {
    // Get characters from this category
    if (category.characters) {
      characters.push(...category.characters);
    }
    // Also get characters from all children
    const extractFromChildren = (cat: CharacterCategory) => {
      if (cat.characters) {
        characters.push(...cat.characters);
      }
      if (cat.children) {
        for (const child of cat.children) {
          extractFromChildren(child);
        }
      }
    };
    if (category.children) {
      for (const child of category.children) {
        extractFromChildren(child);
      }
    }
  }

  return characters;
};

export const searchCharactersInList = (
  characters: CharacterItem[],
  query: string
): CharacterItem[] => {
  const lowerQuery = query.toLowerCase();
  return characters.filter(c => c.name.toLowerCase().includes(lowerQuery));
};
