import api from './api';

export interface CoinBalanceResponse {
  userId: string;
  balance: number;
}

export const fetchBalance = async (
  token: string,
): Promise<CoinBalanceResponse> => {
  return api.get<CoinBalanceResponse>('/api/coins/balance', token);
};

/**
 * Notify the backend that an in-app purchase (or trial) just completed so it
 * can grant the correct number of coins.
 *
 * Backend contract:
 *   POST /api/subscriptions/notify-purchase
 *   Body: { productIdentifier: string, isTrial: boolean, coinsToGrant: number }
 *
 * The frontend now computes coinsToGrant authoritatively: 20 for a fresh-user
 * free trial, otherwise the selected plan's full bonus coins. The backend
 * should credit exactly coinsToGrant rather than re-deriving the amount, so
 * the trial-vs-paid decision stays in one place.
 */
export const notifySubscriptionPurchase = async (
  token: string,
  productIdentifier: string,
  isTrial: boolean,
  coinsToGrant: number,
): Promise<void> => {
  await api.post(
    '/api/subscriptions/notify-purchase',
    {productIdentifier, isTrial, coinsToGrant},
    token,
  );
};
