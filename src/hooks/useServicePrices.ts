import {useState, useEffect, useCallback} from 'react';
import {useAppSelector} from '../store/hooks';
import {
  ServicePrice,
  fetchServicePrices,
  getServicePriceBySortOrder,
} from '../services/servicePricesApi';

interface UseServicePricesResult {
  prices: ServicePrice[];
  isLoading: boolean;
  openEyesPrice: ServicePrice | undefined;
  tryOnPrice: ServicePrice | undefined;
  captionPrice: ServicePrice | undefined;
  extendPrice: ServicePrice | undefined;
  restorePrice: ServicePrice | undefined;
  animationPrice: ServicePrice | undefined;
  refinePrice: ServicePrice | undefined;
  socialContentPrice: ServicePrice | undefined;
}

export const useServicePrices = (): UseServicePricesResult => {
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const accessToken = useAppSelector(state => state.auth.accessToken);

  const load = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await fetchServicePrices(accessToken);
      setPrices(result);
    } catch {
      // Silently fail — buttons just won't show pricing
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    prices,
    isLoading,
    openEyesPrice: getServicePriceBySortOrder(prices, 0),
    tryOnPrice: getServicePriceBySortOrder(prices, 1),
    captionPrice: getServicePriceBySortOrder(prices, 2),
    extendPrice: prices.find(p => p.serviceKey?.toLowerCase() === 'extend') ?? getServicePriceBySortOrder(prices, 3),
    restorePrice: prices.find(p => p.serviceKey?.toLowerCase() === 'restore_photo'),
    animationPrice: prices.find(p => p.serviceKey?.toLowerCase() === 'animation'),
    refinePrice: prices.find(p => p.serviceKey?.toLowerCase() === 'refine'),
    socialContentPrice: prices.find(p => p.serviceKey?.toLowerCase() === 'social_content'),
  };
};
