import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {HistoryStorage, HistoryItem} from '../../utils/storage';

interface HistoryState {
  items: HistoryItem[];
  isLoading: boolean;
  error: string | null;
}

const initialState: HistoryState = {
  items: [],
  isLoading: false,
  error: null,
};

// Async thunks
export const loadHistory = createAsyncThunk(
  'history/loadHistory',
  async () => {
    const history = await HistoryStorage.getHistory();
    return history;
  }
);

export const addToHistory = createAsyncThunk(
  'history/addToHistory',
  async (item: Omit<HistoryItem, 'id' | 'createdAt'>) => {
    const newItem = await HistoryStorage.addToHistory(item);
    return newItem;
  }
);

export const deleteFromHistory = createAsyncThunk(
  'history/deleteFromHistory',
  async (id: string) => {
    await HistoryStorage.deleteFromHistory(id);
    return id;
  }
);

export const clearHistory = createAsyncThunk(
  'history/clearHistory',
  async () => {
    await HistoryStorage.clearHistory();
  }
);

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      // Load history
      .addCase(loadHistory.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadHistory.fulfilled, (state, action: PayloadAction<HistoryItem[]>) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(loadHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to load history';
      })
      // Add to history
      .addCase(addToHistory.fulfilled, (state, action: PayloadAction<HistoryItem>) => {
        state.items.unshift(action.payload);
        // Keep only 50 items
        if (state.items.length > 50) {
          state.items = state.items.slice(0, 50);
        }
      })
      // Delete from history
      .addCase(deleteFromHistory.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(item => item.id !== action.payload);
      })
      // Clear history
      .addCase(clearHistory.fulfilled, state => {
        state.items = [];
      });
  },
});

export default historySlice.reducer;
