import {config} from '../utils/config';

export interface TryOnPromptItem {
  id: string;  // GUID
  icon: string;
  label: string;
  children?: TryOnPromptItem[];
  estimatedCoins?: number;
  isFree?: boolean;
}

export interface TryOnPromptsResponse {
  prompts: TryOnPromptItem[];
}

/**
 * Fetch try-on prompts from the API
 */
export const fetchTryOnPromptsFromApi = async (): Promise<TryOnPromptItem[]> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/TryOnPrompts/light`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch try-on prompts: ${response.status}`);
    }

    const data: TryOnPromptsResponse = await response.json();
    return data.prompts || [];
  } catch (error) {
    console.error('Error fetching try-on prompts from API:', error);
    throw error;
  }
};
