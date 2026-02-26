import {config} from '../utils/config';
import {Sight, SightCategory, CATEGORIES} from '../constants/sights';

// API Response Types
interface ApiCategory {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  thumbnailUrl?: string;
  displayOrder: number;
  isActive: boolean;
  promptCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiPrompt {
  id: string;
  name: string;
  promptText: string;
  thumbnailUrl: string;
  promptType: number;
  promptTypeName: string;
  categoryId: string;
  categoryName: string;
  version: number;
  isActive: boolean;
  sortOrder: number;
  metadata: string;
  createdAt: string;
  updatedAt: string;
  estimatedCoins?: number;
  isFree?: boolean;
}

interface ApiCategoryWithPrompts {
  category: ApiCategory;
  prompts: ApiPrompt[];
}

interface ApiPromptsResponse {
  categories: ApiCategoryWithPrompts[];
  uncategorized: ApiPrompt[];
  totalCount: number;
}

// Map API category names to local SightCategory types
const categoryNameMap: Record<string, SightCategory> = {
  'sights': 'sights',
  'celebrity': 'celebrity',
  'celebrities': 'celebrity',
  'cartoon': 'cartoon',
  'cartoons': 'cartoon',
  'effects': 'effects',
  'games': 'games',
  'eras': 'eras',
  'time travel': 'eras',
  'seasons': 'seasons',
  'art': 'art',
  'art styles': 'art',
  'fantasy': 'fantasy',
  'mountain': 'mountain',
  'birthday': 'birthday',
  'cars': 'cars',
  'movies': 'movies',
  'professional': 'professional'
};

// Convert API category name to local SightCategory
const mapCategoryName = (apiCategoryName: string): SightCategory => {
  const normalizedName = apiCategoryName.toLowerCase().trim();
  return categoryNameMap[normalizedName] || 'effects'; // Default to 'effects' if unknown
};

// Convert API prompt to local Sight format
const convertPromptToSight = (prompt: ApiPrompt): Sight => {
  // Build full thumbnail URL from relative path
  let fullThumbnailUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&h=200&fit=crop';

  if (prompt.thumbnailUrl && prompt.thumbnailUrl.length > 0) {
    if (prompt.thumbnailUrl.startsWith('http://') || prompt.thumbnailUrl.startsWith('https://')) {
      fullThumbnailUrl = prompt.thumbnailUrl;
    } else if (prompt.thumbnailUrl.startsWith('/')) {
      fullThumbnailUrl = `${config.apiBaseUrl}${prompt.thumbnailUrl}`;
    } else {
      fullThumbnailUrl = `${config.apiBaseUrl}/${prompt.thumbnailUrl}`;
    }
  }

  return {
    id: prompt.id,
    name: prompt.name,
    thumbnailUrl: fullThumbnailUrl,
    prompt: prompt.promptText,
    createdAt: prompt.createdAt.split('T')[0], // Convert to YYYY-MM-DD format
    category: mapCategoryName(prompt.categoryName),
    estimatedCoins: prompt.estimatedCoins,
    isFree: prompt.isFree,
  };
};

// Fetch prompts from API
export const fetchPromptsFromApi = async (): Promise<{
  sights: Sight[];
  categories: Array<{id: string; name: string; icon: string}>;
}> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/Prompts`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch prompts: ${response.status}`);
    }

    const data: ApiPromptsResponse = await response.json();

    // Convert API prompts to Sight format
    const sights: Sight[] = [];

    // Process categorized prompts
    data.categories.forEach(categoryWithPrompts => {
      categoryWithPrompts.prompts
        .filter(prompt => prompt.isActive)
        .forEach(prompt => {
          sights.push(convertPromptToSight(prompt));
        });
    });

    // Process uncategorized prompts
    data.uncategorized
      .filter(prompt => prompt.isActive)
      .forEach(prompt => {
        sights.push(convertPromptToSight(prompt));
      });

    // Sort by sortOrder and createdAt
    sights.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Newest first
    });

    // Extract unique categories from API response
    const apiCategories = data.categories
      .filter(c => c.category.isActive)
      .sort((a, b) => a.category.displayOrder - b.category.displayOrder)
      .map(c => {
        // Try category iconUrl/thumbnailUrl first, then fall back to first prompt's thumbnailUrl
        let thumbnailUrl = c.category.thumbnailUrl || c.category.iconUrl;

        // If category has no icon, use the first prompt's thumbnail as category icon
        if ((!thumbnailUrl || thumbnailUrl.length === 0) && c.prompts && c.prompts.length > 0) {
          thumbnailUrl = c.prompts[0].thumbnailUrl;
        }

        let icon: string;

        if (thumbnailUrl && thumbnailUrl.length > 0) {
          // If it's a relative path, prepend the API base URL
          if (thumbnailUrl.startsWith('/')) {
            icon = `${config.apiBaseUrl}${thumbnailUrl}`;
          } else if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
            icon = thumbnailUrl;
          } else {
            // Relative path without leading slash
            icon = `${config.apiBaseUrl}/${thumbnailUrl}`;
          }
        } else {
          icon = getDefaultCategoryIcon(c.category.name);
        }

        console.log(`[PromptsAPI] Category: ${c.category.name}, icon: ${icon}`);

        return {
          id: mapCategoryName(c.category.name),
          name: c.category.name,
          icon: icon,
        };
      });

    return {sights, categories: apiCategories};
  } catch (error) {
    console.error('Error fetching prompts from API:', error);
    throw error;
  }
};

// Get default icon for category
const getDefaultCategoryIcon = (categoryName: string): string => {
  const normalizedName = categoryName.toLowerCase().trim();
  const category = CATEGORIES.find(c =>
    c.id === normalizedName ||
    c.label.toLowerCase() === normalizedName
  );
  return category?.icon || '✨';
};

// Merge API sights with local sights (API takes priority for duplicates)
export const mergeSights = (apiSights: Sight[], localSights: Sight[]): Sight[] => {
  const sightMap = new Map<string, Sight>();

  // Add local sights first
  localSights.forEach(sight => {
    sightMap.set(sight.id, sight);
  });

  // Override with API sights (API takes priority)
  apiSights.forEach(sight => {
    sightMap.set(sight.id, sight);
  });

  return Array.from(sightMap.values());
};
