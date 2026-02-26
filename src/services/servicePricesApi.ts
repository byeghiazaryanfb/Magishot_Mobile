import api from './api';

export interface ServicePrice {
  id: string;
  serviceKey: string;
  displayName: string;
  description?: string;
  icon: string;
  estimatedCoins: number;
  isFree: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

interface ServicePriceListResponse {
  servicePrices: ServicePrice[];
  totalCount: number;
}

// In-memory cache
let cachedPrices: ServicePrice[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch service prices from the API (with in-memory cache)
 */
export const fetchServicePrices = async (
  token?: string,
): Promise<ServicePrice[]> => {
  // Return cached data if still fresh
  if (cachedPrices && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedPrices;
  }

  try {
    const data = await api.get<ServicePriceListResponse>(
      '/api/serviceprices',
      token,
    );
    cachedPrices = data.servicePrices || [];
    cacheTimestamp = Date.now();

    return cachedPrices;
  } catch (error) {
    console.error('[ServicePricesAPI] Error:', error);
    // Return stale cache if available
    if (cachedPrices) {
      return cachedPrices;
    }
    throw error;
  }
};

/**
 * Get a specific service price by sortOrder index.
 * 0 = Open Eyes, 1 = Try On, 2 = Generate Caption
 */
export const getServicePriceBySortOrder = (
  prices: ServicePrice[],
  sortOrder: number,
): ServicePrice | undefined => {
  return prices.find(p => p.sortOrder === sortOrder);
};
