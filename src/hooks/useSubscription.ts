import {useAppSelector} from '../store/hooks';

export const useIsPro = (): boolean => {
  return useAppSelector(state => state.subscription.isPro);
};

export const useCustomerInfo = () => {
  return useAppSelector(state => state.subscription.customerInfo);
};

export const useSubscription = () => {
  return useAppSelector(state => state.subscription);
};
