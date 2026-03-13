import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {transformImage, synthesizeMultipleImages, ImageAsset, GeneratedImage} from '../../services/imageTransform';
import {Sight, SightCategory} from '../../constants/sights';

// Define minimal auth state type to avoid circular import
interface AuthState {
  accessToken: string | null;
}

interface AppState {
  auth: AuthState;
}

export interface SelectedAccessory {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  imageUrl?: string;
  estimatedCoins?: number;
  isFree?: boolean;
}

interface TransformState {
  selectedSight: Sight | null;
  sourceImage: ImageAsset | null;
  transformedImageUrl: string | null;
  synthesizedImages: GeneratedImage[]; // Multiple images for diversity
  isTransforming: boolean;
  showResultModal: boolean;
  error: string | null;
  pinnedSightIds: string[];
  selectedCategory: SightCategory | 'all';
  selectedAccessories: SelectedAccessory[];
  styleMode: 'effects' | 'openeyes' | 'synthesize' | 'cleanBg' | 'restore' | 'animate' | 'refine'; // Studio tab mode
  scenarioPanelExpanded: boolean;
}

const initialState: TransformState = {
  selectedSight: null,
  sourceImage: null,
  transformedImageUrl: null,
  synthesizedImages: [],
  isTransforming: false,
  showResultModal: false,
  error: null,
  pinnedSightIds: [],
  selectedCategory: 'all',
  selectedAccessories: [],
  styleMode: 'effects',
  scenarioPanelExpanded: true,
};

// Async thunk to transform the image
export const transformImageThunk = createAsyncThunk<
  string | undefined,
  {image: ImageAsset; promptId?: string; accessoryIds?: string[]},
  {state: AppState; rejectValue: string}
>(
  'transform/transformImage',
  async (
    {image, promptId, accessoryIds},
    {rejectWithValue, getState},
  ) => {
    const accessToken = getState().auth?.accessToken || undefined;
    console.log('[transformImageThunk] Auth token present:', !!accessToken);
    const response = await transformImage({image, promptId, accessoryIds, accessToken});
    if (!response.success) {
      return rejectWithValue(response.error || 'Failed to transform image');
    }
    return response.imageUrl;
  },
);

// Async thunk for "Look Like This" - synthesize multiple images
export const synthesizeImagesThunk = createAsyncThunk<
  GeneratedImage[],
  {sourceImage: ImageAsset; referenceImages: ImageAsset[]; actionId?: string},
  {state: AppState; rejectValue: string}
>(
  'transform/synthesizeImages',
  async (
    {sourceImage, referenceImages, actionId},
    {rejectWithValue, getState},
  ) => {
    const accessToken = getState().auth.accessToken || undefined;
    const response = await synthesizeMultipleImages({sourceImage, referenceImages, actionId, accessToken});
    if (!response.success) {
      return rejectWithValue(response.error || 'Failed to synthesize images');
    }
    return response.images || [];
  },
);

const transformSlice = createSlice({
  name: 'transform',
  initialState,
  reducers: {
    setSelectedSight: (state, action: PayloadAction<Sight | null>) => {
      state.selectedSight = action.payload;
    },
    setSourceImage: (state, action: PayloadAction<ImageAsset | null>) => {
      state.sourceImage = action.payload;
    },
    setTransformedImageUrl: (state, action: PayloadAction<string | null>) => {
      state.transformedImageUrl = action.payload;
    },
    showResultModal: (state) => {
      state.showResultModal = true;
    },
    hideResultModal: (state) => {
      state.showResultModal = false;
      state.transformedImageUrl = null;
      state.synthesizedImages = [];
      state.error = null;
    },
    clearTransformState: (state) => {
      state.sourceImage = null;
      state.transformedImageUrl = null;
      state.synthesizedImages = [];
      state.isTransforming = false;
      state.showResultModal = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    togglePinSight: (state, action: PayloadAction<string>) => {
      const sightId = action.payload;
      const index = state.pinnedSightIds.indexOf(sightId);
      if (index === -1) {
        // Add to pinned
        state.pinnedSightIds.push(sightId);
      } else {
        // Remove from pinned
        state.pinnedSightIds.splice(index, 1);
      }
    },
    setPinnedSights: (state, action: PayloadAction<string[]>) => {
      state.pinnedSightIds = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<SightCategory | 'all'>) => {
      state.selectedCategory = action.payload;
    },
    setSelectedAccessories: (state, action: PayloadAction<SelectedAccessory[]>) => {
      state.selectedAccessories = action.payload;
    },
    addAccessory: (state, action: PayloadAction<SelectedAccessory>) => {
      const exists = state.selectedAccessories.find(a => a.id === action.payload.id);
      if (!exists) {
        state.selectedAccessories.push(action.payload);
      }
    },
    removeAccessory: (state, action: PayloadAction<string>) => {
      state.selectedAccessories = state.selectedAccessories.filter(a => a.id !== action.payload);
    },
    clearAccessories: (state) => {
      state.selectedAccessories = [];
    },
    setStyleMode: (state, action: PayloadAction<'effects' | 'openeyes' | 'synthesize' | 'cleanBg' | 'restore' | 'animate' | 'refine'>) => {
      state.styleMode = action.payload;
    },
    setScenarioPanelExpanded: (state, action: PayloadAction<boolean>) => {
      state.scenarioPanelExpanded = action.payload;
    },
    toggleScenarioPanel: (state) => {
      state.scenarioPanelExpanded = !state.scenarioPanelExpanded;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(transformImageThunk.pending, (state) => {
        state.isTransforming = true;
        state.error = null;
      })
      .addCase(transformImageThunk.fulfilled, (state, action) => {
        state.isTransforming = false;
        state.transformedImageUrl = action.payload || null;
        state.showResultModal = true;
      })
      .addCase(transformImageThunk.rejected, (state, action) => {
        state.isTransforming = false;
        state.error = action.payload as string;
      })
      // Synthesize multiple images (Look Like This)
      .addCase(synthesizeImagesThunk.pending, (state) => {
        state.isTransforming = true;
        state.error = null;
        state.synthesizedImages = [];
      })
      .addCase(synthesizeImagesThunk.fulfilled, (state, action) => {
        state.isTransforming = false;
        state.synthesizedImages = action.payload || [];
        // Set the first image as transformedImageUrl for backwards compatibility
        state.transformedImageUrl = action.payload?.[0]?.imageUrl || null;
        state.showResultModal = true;
      })
      .addCase(synthesizeImagesThunk.rejected, (state, action) => {
        state.isTransforming = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedSight,
  setSourceImage,
  setTransformedImageUrl,
  showResultModal,
  hideResultModal,
  clearTransformState,
  clearError,
  togglePinSight,
  setPinnedSights,
  setSelectedCategory,
  setSelectedAccessories,
  addAccessory,
  removeAccessory,
  clearAccessories,
  setStyleMode,
  setScenarioPanelExpanded,
  toggleScenarioPanel,
} = transformSlice.actions;

export default transformSlice.reducer;
