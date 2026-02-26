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
