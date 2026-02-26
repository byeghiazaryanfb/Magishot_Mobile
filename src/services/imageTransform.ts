import {config} from '../utils/config';

export interface GeneratedImage {
  imageUrl: string;
  fileName: string;
  mimeType: string;
}

export interface GeminiEditImageUrlResponse {
  imageUrl: string;
  fileName: string;
  mimeType: string;
  prompt: string;
}

export interface GeminiSynthesizeResponse {
  images: GeneratedImage[];
}

export interface TransformImageResponse {
  success: boolean;
  imageUrl?: string;
  fileName?: string;
  mimeType?: string;
  error?: string;
}

export interface SynthesizeImageResponse {
  success: boolean;
  images?: GeneratedImage[];
  error?: string;
}

export interface ImageAsset {
  uri: string;
  type?: string;
  fileName?: string;
}

export interface SynthesizeImagesRequest {
  sourceImage?: ImageAsset;      // Local file (camera/gallery)
  sourceImageUrl?: string;       // Remote URL (character from library)
  referenceImages: ImageAsset[];
  actionId?: string;             // Action ID from API
  accessToken?: string;          // Auth token for authenticated requests
}

export interface TransformOptions {
  image: ImageAsset;
  promptId?: string;        // Template ID (optional)
  accessoryIds?: string[];  // Multiple accessory IDs (optional)
  accessToken?: string;     // Auth token for authenticated requests
}

/**
 * Generate an image using the Gemini API with template and/or accessories
 * @param options - Transform options including image, promptId (template), and/or accessoryIds
 * @returns Promise with the generated image URL
 */
export async function transformImage(
  options: TransformOptions,
): Promise<TransformImageResponse> {
  const {image, promptId, accessoryIds, accessToken} = options;

  // At least one of promptId or accessoryIds must be provided
  if (!promptId && (!accessoryIds || accessoryIds.length === 0)) {
    return {
      success: false,
      error: 'Please select a template or accessory',
    };
  }

  const formData = new FormData();

  // Get the file extension and mime type
  const fileExtension = image.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = image.type || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;

  // Append the image file
  formData.append('image', {
    uri: image.uri,
    type: mimeType,
    name: image.fileName || `photo.${fileExtension}`,
  } as any);

  // Append promptId if provided (template)
  if (promptId) {
    formData.append('promptId', promptId);
  }

  // Append accessoryIds if provided (can be multiple)
  if (accessoryIds && accessoryIds.length > 0) {
    accessoryIds.forEach(accessoryId => {
      formData.append('accessoryIds', accessoryId);
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.imageTransformTimeout);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    console.log('[transformImage] Headers include Auth:', !!headers.Authorization);

    const response = await fetch(
      `${config.geminiApiBaseUrl}/api/gemini/geminiimage/generate`,
      {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }

    // The API returns a JSON object with imageUrl, fileName, mimeType
    const data: GeneratedImage = await response.json();

    return {
      success: true,
      imageUrl: data.imageUrl,
      fileName: data.fileName,
      mimeType: data.mimeType,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please try again.',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unknown error occurred',
    };
  }
}

/**
 * Synthesize multiple images using the Gemini API (Look Like This feature)
 * Transforms the source image to match the style of reference image(s)
 * @param request - Contains sourceImage OR sourceImageUrl, referenceImages, and optional prompt
 * @returns Promise with multiple generated images for diversity
 */
export async function synthesizeMultipleImages(
  request: SynthesizeImagesRequest,
): Promise<SynthesizeImageResponse> {
  const {sourceImage, sourceImageUrl, referenceImages, actionId, accessToken} = request;
  const formData = new FormData();

  // Helper to get mime type from image
  const getMimeType = (image: ImageAsset): string => {
    const fileExtension = image.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
    return image.type || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
  };

  // Helper to check if URI is a remote URL
  const isRemoteUrl = (uri: string): boolean => {
    return uri.startsWith('http://') || uri.startsWith('https://');
  };

  // Append source image - either as file or URL
  if (sourceImageUrl) {
    // Character from library - send URL string
    formData.append('sourceImageUrl', sourceImageUrl);
  } else if (sourceImage) {
    if (isRemoteUrl(sourceImage.uri)) {
      // Remote URL - send as URL string
      formData.append('sourceImageUrl', sourceImage.uri);
    } else {
      // Local file - send as file upload
      const sourceMimeType = getMimeType(sourceImage);
      const sourceExtension = sourceImage.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      formData.append('sourceImage', {
        uri: sourceImage.uri,
        type: sourceMimeType,
        name: sourceImage.fileName || `source.${sourceExtension}`,
      } as any);
    }
  }

  // Append reference images (style references)
  referenceImages.forEach((refImage, index) => {
    const refMimeType = getMimeType(refImage);
    const refExtension = refImage.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
    formData.append('referenceImages', {
      uri: refImage.uri,
      type: refMimeType,
      name: refImage.fileName || `reference_${index}.${refExtension}`,
    } as any);
  });

  // Append the action ID
  if (actionId) {
    formData.append('actionId', actionId);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.imageTransformTimeout);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(
      `${config.geminiApiBaseUrl}/api/gemini/GeminiImage/synthesize-multiple-images`,
      {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }

    const data: GeminiSynthesizeResponse = await response.json();

    return {
      success: true,
      images: data.images,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please try again.',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unknown error occurred',
    };
  }
}
