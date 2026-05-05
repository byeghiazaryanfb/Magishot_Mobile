import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import type {CustomerInfo} from 'react-native-purchases';
import {
  getCustomerInfo,
  isProActive,
  restorePurchases,
} from '../../services/purchases';

interface SubscriptionState {
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  isRefreshing: boolean;
  lastSyncedAt: number | null;
}

const initialState: SubscriptionState = {
  isPro: false,
  customerInfo: null,
  isRefreshing: false,
  lastSyncedAt: null,
};

export const refreshSubscription = createAsyncThunk<CustomerInfo | null>(
  'subscription/refresh',
  async () => {
    return getCustomerInfo();
  },
);

export const restoreSubscription = createAsyncThunk<
  CustomerInfo | null,
  void,
  {rejectValue: string}
>('subscription/restore', async (_, {rejectWithValue}) => {
  try {
    return await restorePurchases();
  } catch (err: any) {
    return rejectWithValue(err?.message || 'Restore failed');
  }
});

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    setCustomerInfo: (state, action: PayloadAction<CustomerInfo | null>) => {
      state.customerInfo = action.payload;
      state.isPro = isProActive(action.payload);
      state.lastSyncedAt = Date.now();
    },
    clearSubscription: state => {
      state.customerInfo = null;
      state.isPro = false;
      state.lastSyncedAt = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(refreshSubscription.pending, state => {
        state.isRefreshing = true;
      })
      .addCase(refreshSubscription.fulfilled, (state, action) => {
        state.isRefreshing = false;
        state.customerInfo = action.payload;
        state.isPro = isProActive(action.payload);
        state.lastSyncedAt = Date.now();
      })
      .addCase(refreshSubscription.rejected, state => {
        state.isRefreshing = false;
      })
      .addCase(restoreSubscription.pending, state => {
        state.isRefreshing = true;
      })
      .addCase(restoreSubscription.fulfilled, (state, action) => {
        state.isRefreshing = false;
        state.customerInfo = action.payload;
        state.isPro = isProActive(action.payload);
        state.lastSyncedAt = Date.now();
      })
      .addCase(restoreSubscription.rejected, state => {
        state.isRefreshing = false;
      });
  },
});

export const {setCustomerInfo, clearSubscription} = subscriptionSlice.actions;
export default subscriptionSlice.reducer;
