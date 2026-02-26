import {config} from '../utils/config';
import type {ImageAsset} from './imageTransform';

export interface CaptionResponse {
  caption: string;
  captionType: string;
}

export interface GenerateCaptionOptions {
  image: ImageAsset;
  captionType: string;
  accessToken?: string;
}

/**
 * Generate an AI caption for an image
 * @param options - Image, caption style, and auth token
 * @returns Promise with the generated caption
 */
export async function generateCaption(
  options: GenerateCaptionOptions,
): Promise<{success: boolean; caption?: string; captionType?: string; error?: string}> {
  const {image, captionType, accessToken} = options;

  const formData = new FormData();

  const fileExtension =
    image.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType =
    image.type || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;

  formData.append('image', {
    uri: image.uri,
    type: mimeType,
    name: image.fileName || `photo.${fileExtension}`,
  } as any);

  formData.append('captionType', captionType);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(
      `${config.geminiApiBaseUrl}/api/gemini/GeminiImage/caption`,
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

    const data: CaptionResponse = await response.json();

    return {
      success: true,
      caption: data.caption,
      captionType: data.captionType,
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
