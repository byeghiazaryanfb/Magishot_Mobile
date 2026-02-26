import {config} from '../utils/config';

export interface ProductItem {
  id: string;
  name: string;
  categoryId: string;  // GUID - used as tryOnPromptId
  imageUrl: string;
  thumbnail?: string;
  estimatedCoins?: number;
  isFree?: boolean;
}

export interface ProductsResponse {
  products: ProductItem[];
}

export const fetchProductsFromApi = async (): Promise<ProductItem[]> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/TryOnProducts/light`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Handle both array response and object with products property
    if (Array.isArray(data)) {
      return data;
    }

    return data.products || [];
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
};
