import RNFS from 'react-native-fs';
import {config} from '../utils/config';
import {ImageAsset, GeneratedImage} from './imageTransform';

export interface TryOnRequest {
  personImage: ImageAsset;
  productImage?: ImageAsset;
  productImageUrl?: string;
  tryOnPromptId: string;  // GUID from try-on prompts API
  accessToken?: string;   // Auth token for authenticated requests
}

export interface TryOnResponse {
  success: boolean;
  images?: GeneratedImage[];
  error?: string;
}

/**
 * Download an image from URL to a local file
 */
async function downloadImageToFile(url: string): Promise<string | null> {
  try {
    // Extract file extension from URL or default to jpg
    const urlPath = url.split('?')[0]; // Remove query params
    const extension = urlPath.match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[1] || 'jpg';
    const fileName = `product_${Date.now()}.${extension}`;
    const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: filePath,
    }).promise;

    if (downloadResult.statusCode === 200) {
      return filePath;
    }
    return null;
  } catch (error) {
    console.error('Failed to download image:', error);
    return null;
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return mimeTypes[extension] || 'image/jpeg';
}

/**
 * Virtual Try-On API call
 * Sends person photo and product photo/URL to generate try-on result
 */
export async function tryOnProduct(request: TryOnRequest): Promise<TryOnResponse> {
  const {personImage, productImage, productImageUrl, tryOnPromptId, accessToken} = request;
  const formData = new FormData();
  let downloadedFilePath: string | null = null;

  // Helper to get mime type from image
  const getMimeType = (image: ImageAsset): string => {
    const fileExtension = image.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
    return image.type || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
  };

  // Helper to check if URI is a remote URL
  const isRemoteUrl = (uri: string): boolean => {
    return uri.startsWith('http://') || uri.startsWith('https://');
  };

  try {
    // Append person image (source)
    if (isRemoteUrl(personImage.uri)) {
      formData.append('sourceImageUrl', personImage.uri);
    } else {
      const personMimeType = getMimeType(personImage);
      const personExtension = personImage.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      formData.append('sourceImage', {
        uri: personImage.uri,
        type: personMimeType,
        name: personImage.fileName || `person.${personExtension}`,
      } as any);
    }

    // Append product image - download from URL if needed
    if (productImageUrl) {
      // Download the image from URL first
      downloadedFilePath = await downloadImageToFile(productImageUrl);
      if (!downloadedFilePath) {
        return {
          success: false,
          error: 'Failed to download product image from URL',
        };
      }
      const mimeType = getMimeTypeFromPath(downloadedFilePath);
      const fileName = downloadedFilePath.split('/').pop() || 'product.jpg';
      formData.append('referenceImages', {
        uri: `file://${downloadedFilePath}`,
        type: mimeType,
        name: fileName,
      } as any);
    } else if (productImage) {
      if (isRemoteUrl(productImage.uri)) {
        // Download the image from URL first
        downloadedFilePath = await downloadImageToFile(productImage.uri);
        if (!downloadedFilePath) {
          return {
            success: false,
            error: 'Failed to download product image from URL',
          };
        }
        const mimeType = getMimeTypeFromPath(downloadedFilePath);
        const fileName = downloadedFilePath.split('/').pop() || 'product.jpg';
        formData.append('referenceImages', {
          uri: `file://${downloadedFilePath}`,
          type: mimeType,
          name: fileName,
        } as any);
      } else {
        const productMimeType = getMimeType(productImage);
        const productExtension = productImage.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
        formData.append('referenceImages', {
          uri: productImage.uri,
          type: productMimeType,
          name: productImage.fileName || `product.${productExtension}`,
        } as any);
      }
    }

    // Append try-on prompt ID (GUID)
    formData.append('tryOnPromptId', tryOnPromptId);

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

    // Clean up downloaded file if any
    if (downloadedFilePath) {
      try {
        await RNFS.unlink(downloadedFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      images: data.images,
    };
  } catch (error) {
    // Clean up downloaded file on error
    if (downloadedFilePath) {
      try {
        await RNFS.unlink(downloadedFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

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

