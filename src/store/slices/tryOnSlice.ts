import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {ImageAsset, GeneratedImage} from '../../services/imageTransform';
import {tryOnProduct} from '../../services/tryOnService';
import {ProductItem} from '../../services/productsApi';

// Define minimal auth state type to avoid circular import
interface AuthState {
  accessToken: string | null;
}

interface AppState {
  auth: AuthState;
}

interface TryOnState {
  personImage: ImageAsset | null;
  productImage: ImageAsset | null;
  productImageUrl: string | null;
  selectedProduct: ProductItem | null;
  selectedTryOnPromptId: string | null;
  generatedImages: GeneratedImage[];
  isGenerating: boolean;
  showResultModal: boolean;
  error: string | null;
}

const initialState: TryOnState = {
  personImage: null,
  productImage: null,
  productImageUrl: null,
  selectedProduct: null,
  selectedTryOnPromptId: null,
  generatedImages: [],
  isGenerating: false,
  showResultModal: false,
  error: null,
};

// Async thunk for try-on generation
export const tryOnThunk = createAsyncThunk<
  GeneratedImage[],
  {
    personImage: ImageAsset;
    productImage?: ImageAsset;
    productImageUrl?: string;
    tryOnPromptId: string;
  },
  {state: AppState; rejectValue: string}
>(
  'tryOn/generate',
  async (
    {personImage, productImage, productImageUrl, tryOnPromptId},
    {rejectWithValue, getState},
  ) => {
    const accessToken = getState().auth.accessToken || undefined;
    const response = await tryOnProduct({
      personImage,
      productImage,
      productImageUrl,
      tryOnPromptId,
      accessToken,
    });
    if (!response.success) {
      return rejectWithValue(response.error || 'Failed to generate try-on');
    }
    return response.images || [];
  },
);

const tryOnSlice = createSlice({
  name: 'tryOn',
  initialState,
  reducers: {
    setPersonImage: (state, action: PayloadAction<ImageAsset | null>) => {
      state.personImage = action.payload;
    },
    setProductImage: (state, action: PayloadAction<ImageAsset | null>) => {
      state.productImage = action.payload;
      state.productImageUrl = null;
      state.selectedProduct = null;
    },
    setProductImageUrl: (state, action: PayloadAction<string | null>) => {
      state.productImageUrl = action.payload;
      state.productImage = null;
      state.selectedProduct = null;
    },
    setSelectedProduct: (state, action: PayloadAction<ProductItem | null>) => {
      state.selectedProduct = action.payload;
      if (action.payload) {
        state.productImageUrl = action.payload.imageUrl;
        state.productImage = null;
      }
    },
    setSelectedTryOnPromptId: (state, action: PayloadAction<string | null>) => {
      state.selectedTryOnPromptId = action.payload;
    },
    showTryOnResultModal: (state) => {
      state.showResultModal = true;
    },
    hideTryOnResultModal: (state) => {
      state.showResultModal = false;
      state.generatedImages = [];
      state.error = null;
    },
    clearTryOnState: (state) => {
      state.personImage = null;
      state.productImage = null;
      state.productImageUrl = null;
      state.selectedProduct = null;
      state.selectedTryOnPromptId = null;
      state.generatedImages = [];
      state.isGenerating = false;
      state.showResultModal = false;
      state.error = null;
    },
    clearTryOnError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(tryOnThunk.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
        state.generatedImages = [];
      })
      .addCase(tryOnThunk.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.generatedImages = action.payload || [];
        state.showResultModal = true;
      })
      .addCase(tryOnThunk.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setPersonImage,
  setProductImage,
  setProductImageUrl,
  setSelectedProduct,
  setSelectedTryOnPromptId,
  showTryOnResultModal,
  hideTryOnResultModal,
  clearTryOnState,
  clearTryOnError,
} = tryOnSlice.actions;

export default tryOnSlice.reducer;
