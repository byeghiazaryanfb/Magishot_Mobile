/**
 * Filters API service for fetching and applying filters
 */

import config from '../utils/config';

// Types matching the API response

// Category info from API
export interface ApiCategoryInfo {
  id: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  filterCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

// Filter from API
export interface ApiFilter {
  id: string;
  name: string;
  promptText?: string;
  thumbnailUrl?: string | null;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  sortOrder: number;
  metadata?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  estimatedCoins?: number;
  isFree?: boolean;
}

// Category with filters from grouped endpoint
export interface ApiCategoryWithFilters {
  category: ApiCategoryInfo;
  filters: ApiFilter[];
}

// Grouped response from /api/filters
export interface FilterGroupedResponse {
  categories: ApiCategoryWithFilters[];
  totalCount: number;
}

// Simplified category for internal use
export interface FilterCategory {
  categoryId: string;
  categoryName: string;
  iconUrl?: string | null;
  displayOrder: number;
  filters: ApiFilter[];
}

export interface ApplyFilterResponse {
  imageUrl: string;
  fileName: string;
  mimeType: string;
  filterId: string;
  filterName: string;
  promptUsed: string;
}

// Helper to get full thumbnail URL from relative path
export const getFullThumbnailUrl = (thumbnailUrl?: string | null): string | null => {
  if (!thumbnailUrl) return null;
  if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
    return thumbnailUrl;
  }
  // Prepend API base URL for relative paths
  return `${config.apiBaseUrl}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
};

class FiltersApiService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.timeout = config.imageTransformTimeout;
  }

  /**
   * Fetch all filters grouped by category (includes thumbnails)
   * Uses /api/filters endpoint
   */
  async getFiltersGrouped(): Promise<FilterCategory[]> {
    const url = `${this.baseUrl}/api/filters`;
    console.log('=== FILTERS API REQUEST (GROUPED) ===');
    console.log('URL:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('=== FILTERS API RESPONSE ===');
      console.log('Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Filters API Error:', response.status, errorText);
        throw new Error(`Failed to fetch filters: ${response.status}`);
      }

      const data: FilterGroupedResponse = await response.json();
      console.log('Filters API Response - Total count:', data.totalCount);
      console.log('Categories count:', data.categories?.length || 0);

      // Transform to simplified FilterCategory format
      const categories: FilterCategory[] = (data.categories || [])
        .filter(cat => cat.category.isActive)
        .sort((a, b) => a.category.displayOrder - b.category.displayOrder)
        .map(cat => ({
          categoryId: cat.category.id,
          categoryName: cat.category.name,
          iconUrl: cat.category.iconUrl,
          displayOrder: cat.category.displayOrder,
          filters: (cat.filters || [])
            .filter(f => f.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }));

      return categories;
    } catch (error) {
      console.warn('Filters API Error:', error);
      throw error;
    }
  }

  /**
   * Fetch all filters as flat list (includes thumbnails)
   * Uses /api/filters/all endpoint
   */
  async getFilters(): Promise<ApiFilter[]> {
    const url = `${this.baseUrl}/api/filters/all?includeInactive=false`;
    console.log('=== FILTERS API REQUEST (ALL) ===');
    console.log('URL:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('=== FILTERS API RESPONSE ===');
      console.log('Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Filters API Error:', response.status, errorText);
        throw new Error(`Failed to fetch filters: ${response.status}`);
      }

      const data = await response.json();
      console.log('Filters API Response - Total count:', data.totalCount);

      // Handle response format { filters: [...], totalCount: N }
      const filters: ApiFilter[] = data.filters || [];
      return filters.filter(f => f.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (error) {
      console.warn('Filters API Error:', error);
      throw error;
    }
  }

  /**
   * Group filters by category (for backward compatibility)
   */
  groupFiltersByCategory(filters: ApiFilter[]): FilterCategory[] {
    if (!Array.isArray(filters)) {
      console.warn('groupFiltersByCategory received non-array:', typeof filters);
      return [];
    }

    const categoryMap = new Map<string, FilterCategory>();

    for (const filter of filters) {
      if (!filter || typeof filter !== 'object' || !filter.categoryId) {
        continue;
      }

      if (!categoryMap.has(filter.categoryId)) {
        categoryMap.set(filter.categoryId, {
          categoryId: filter.categoryId,
          categoryName: filter.categoryName || 'Other',
          displayOrder: 0,
          filters: [],
        });
      }
      categoryMap.get(filter.categoryId)!.filters.push(filter);
    }

    return Array.from(categoryMap.values());
  }

  /**
   * Apply a filter to an image
   * @param imageUri - Local URI of the image to filter
   * @param filterId - GUID of the filter to apply
   * @param accessToken - Optional auth token for authenticated requests
   */
  async applyFilter(imageUri: string, filterId: string, accessToken?: string): Promise<ApplyFilterResponse> {
    const url = `${this.baseUrl}/api/filter-image/apply`;
    console.log('=== APPLY FILTER API REQUEST ===');
    console.log('URL:', url);
    console.log('Filter ID:', filterId);
    console.log('Image URI:', imageUri);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const formData = new FormData();
      const fileName = imageUri.split('/').pop() || 'image.jpg';

      const extension = fileName.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (extension === 'png') mimeType = 'image/png';
      else if (extension === 'gif') mimeType = 'image/gif';
      else if (extension === 'webp') mimeType = 'image/webp';

      formData.append('image', {
        uri: imageUri,
        type: mimeType,
        name: fileName,
      } as any);

      formData.append('filterId', filterId);

      console.log('FormData created with image and filterId');

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('=== APPLY FILTER API RESPONSE ===');
      console.log('Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apply Filter API Error:', errorText);
        throw new Error(`Failed to apply filter: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Filter applied successfully:', data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Apply Filter API Error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Filter request timeout');
      }
      throw error;
    }
  }
}

export default new FiltersApiService();
