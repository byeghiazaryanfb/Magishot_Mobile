import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {store} from '../store';
import {useAppDispatch} from '../store/hooks';
import {setCustomerInfo} from '../store/slices/subscriptionSlice';
import {notifySubscriptionPurchase} from '../services/coinBalanceApi';
import PaywallScreen from './PaywallScreen';

/**
 * Subscription screen shown when the user taps "Subscription" in the drawer.
 * Delegates entirely to PaywallScreen which is wired to RevenueCat, shows live
 * prices, reflects the user's current active plan, and handles upgrades/downgrades.
 */
const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const handleClose = () => {
    navigation.goBack();
  };

  const handlePurchase = async (
    productIdentifier: string,
    isTrial: boolean,
    coinsToGrant: number,
  ) => {
    console.log('[Subscription] notify-purchase payload →', {
      productIdentifier,
      isTrial,
      coinsToGrant,
    });
    try {
      const token = store.getState().auth.accessToken;
      if (token) {
        await notifySubscriptionPurchase(
          token,
          productIdentifier,
          isTrial,
          coinsToGrant,
        );
        console.log('[Subscription] notify-purchase OK');
      }
    } catch (err) {
      console.warn('[Subscription] notify-purchase failed:', err);
      // Non-fatal — RevenueCat webhook is the fallback coin-grant mechanism.
    }
    navigation.goBack();
  };

  return (
    <PaywallScreen
      onClose={handleClose}
      onPurchase={handlePurchase}
    />
  );
};

export default SubscriptionScreen;
