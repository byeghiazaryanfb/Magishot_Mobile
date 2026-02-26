export type SightCategory = 'sights' | 'celebrity' | 'cartoon' | 'effects' | 'games' | 'eras' | 'seasons' | 'art' | 'fantasy' | 'mountain' | 'birthday' | 'cars' | 'movies' | 'professional';

export interface Sight {
  id: string;
  name: string;
  thumbnailUrl: string;
  prompt: string;
  createdAt: string; // ISO date string
  category: SightCategory;
  estimatedCoins?: number;
  isFree?: boolean;
}

export const CATEGORIES: {id: SightCategory | 'all'; label: string; icon: string}[] = [
  {id: 'all', label: 'All', icon: '🌟'},
  {id: 'sights', label: 'Sights', icon: '🏛️'},
  {id: 'celebrity', label: 'Celebrity', icon: '⭐'},
  {id: 'cartoon', label: 'Cartoon', icon: '🎭'},
  {id: 'effects', label: 'Effects', icon: '✨'},
  {id: 'games', label: 'Games', icon: '🎮'},
  {id: 'eras', label: 'Time Travel', icon: '⏳'},
  {id: 'seasons', label: 'Seasons', icon: '🌸'},
  {id: 'art', label: 'Art Styles', icon: '🎨'},
  {id: 'fantasy', label: 'Fantasy', icon: '🧙'},
  {id: 'mountain', label: 'Mountain', icon: '🏔️'},
  {id: 'birthday', label: 'Birthday', icon: '🎂'},
  {id: 'cars', label: 'Cars', icon: '🚗'},
  {id: 'movies', label: 'Movies', icon: '🎬'},
  {id: 'professional', label: 'Professional', icon: '💼'},
];

// Helper to check if a sight is new (added within last 10 days)
export const isNewSight = (sight: Sight): boolean => {
  const createdDate = new Date(sight.createdAt);
  const now = new Date();
  const diffTime = now.getTime() - createdDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= 10;
};

// Empty array - prompts are now fetched from API
// Local sights can be added here as fallback if needed
export const SIGHTS: Sight[] = [];
