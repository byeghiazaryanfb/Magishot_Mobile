import {config} from '../utils/config';

// Accessory Type Enum
// Type = 1: Accessory (glasses, hats, crowns, masks, jewelry, scarves, headphones, bows, wings, horns, halos, outfits, effects)
// Type = 2: Appearance (beard, makeup, hairstyles including all hair-color, hair-length, hair-style children)
export enum AccessoryType {
  Accessory = 1,
  Appearance = 2,
}

export interface AccessoryItem {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  imageUrl?: string;  // Preview image URL (relative path from API)
  type?: AccessoryType;  // For filtering: 1 = Accessory, 2 = Appearance
  children?: AccessoryItem[];
  estimatedCoins?: number;
  isFree?: boolean;
}

export interface AccessoriesResponse {
  accessories: AccessoryItem[];
}

/**
 * Transform accessories to expand hair-color from hairstyles
 */
const expandHairColor = (accessories: AccessoryItem[]): AccessoryItem[] => {
  const result: AccessoryItem[] = [];
  let hairColorCategory: AccessoryItem | null = null;

  for (const item of accessories) {
    // Check if this is the hairstyles category
    if (item.id === 'hairstyles' || item.label.toLowerCase() === 'hairstyles') {
      // Find and extract hair-color from children
      if (item.children && item.children.length > 0) {
        const hairColorChild = item.children.find(
          child => child.id === 'hair-color' || child.label.toLowerCase() === 'hair color'
        );

        if (hairColorChild) {
          // Create a new top-level Hair Color category
          hairColorCategory = {
            ...hairColorChild,
            id: 'hair-color',
            label: 'Hair Color',
            icon: '🎨',
            type: item.type, // Keep same type as parent (Appearance)
          };

          // Remove hair-color from hairstyles children
          const filteredChildren = item.children.filter(
            child => child.id !== 'hair-color' && child.label.toLowerCase() !== 'hair color'
          );

          // Add hairstyles without hair-color
          result.push({
            ...item,
            children: filteredChildren,
          });
        } else {
          result.push(item);
        }
      } else {
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }

  // Add Hair Color as a separate category after hairstyles
  if (hairColorCategory) {
    // Find index of hairstyles to insert hair color right after it
    const hairstylesIndex = result.findIndex(
      item => item.id === 'hairstyles' || item.label.toLowerCase() === 'hairstyles'
    );
    if (hairstylesIndex !== -1) {
      result.splice(hairstylesIndex + 1, 0, hairColorCategory);
    } else {
      result.push(hairColorCategory);
    }
  }

  return result;
};

/**
 * Fetch accessories from the API
 */
export const fetchAccessoriesFromApi = async (): Promise<AccessoryItem[]> => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/accessories/light`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch accessories: ${response.status}`);
    }

    const data: AccessoriesResponse = await response.json();
    const accessories = data.accessories || [];

    // Expand hair-color from hairstyles into its own category
    return expandHairColor(accessories);
  } catch (error) {
    throw error;
  }
};
