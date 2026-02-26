import {config} from '../utils/config';

export interface ActionItem {
  id: string;
  icon: string;
  label: string;
  prompt?: string;
  imageUrl?: string;  // Preview image URL (relative path from API)
  children?: ActionItem[];
  estimatedCoins?: number;
  isFree?: boolean;
}

export interface ActionsResponse {
  actions: ActionItem[];
}

/**
 * Fetch actions from the API
 */
export const fetchActionsFromApi = async (): Promise<ActionItem[]> => {
  try {
    const url = `${config.apiBaseUrl}/api/actions/light`;
    console.log('[ActionsAPI] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch actions: ${response.status}`);
    }

    const data = await response.json();
    console.log('[ActionsAPI] Raw response:', JSON.stringify(data, null, 2));

    // Check if response has 'actions' key
    const actions = data.actions || [];
    console.log('[ActionsAPI] Actions count:', actions.length);

    return actions;
  } catch (error) {
    console.error('[ActionsAPI] Error fetching actions:', error);
    throw error;
  }
};
