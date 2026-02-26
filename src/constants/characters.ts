// import {config} from '../utils/config';

export type CharacterCategory = 'celebrities' | 'fictional' | 'historical';

export interface Character {
  id: string;
  name: string;
  imageUrl: string;
  category: CharacterCategory;
  subcategory?: string;
}

export interface CharacterSubcategory {
  id: string;
  label: string;
  icon: string;
}

export const CHARACTER_CATEGORIES: Record<CharacterCategory, {label: string; icon: string; subcategories: CharacterSubcategory[]}> = {
  celebrities: {
    label: 'Celebrities',
    icon: '⭐',
    subcategories: [
      {id: 'actors', label: 'Actors', icon: '🎬'},
      {id: 'musicians', label: 'Musicians', icon: '🎤'},
      {id: 'athletes', label: 'Athletes', icon: '⚽'},
      {id: 'influencers', label: 'Influencers', icon: '📱'},
    ],
  },
  fictional: {
    label: 'Fictional',
    icon: '🎭',
    subcategories: [
      {id: 'superheroes', label: 'Superheroes', icon: '🦸'},
      {id: 'movie_characters', label: 'Movie Characters', icon: '🎥'},
      {id: 'anime', label: 'Anime', icon: '🇯🇵'},
      {id: 'cartoons', label: 'Cartoons', icon: '🎨'},
    ],
  },
  historical: {
    label: 'Historical',
    icon: '📜',
    subcategories: [
      {id: 'leaders', label: 'Leaders', icon: '👑'},
      {id: 'scientists', label: 'Scientists', icon: '🔬'},
      {id: 'artists', label: 'Artists', icon: '🎨'},
      {id: 'explorers', label: 'Explorers', icon: '🧭'},
    ],
  },
};

// Base URL for character images on your server
// const getCharacterImageUrl = (filename: string) =>
//   `${config.geminiApiBaseUrl}/character-images/${filename}`;

// Character library - now fetched from backend API
// See src/services/charactersApi.ts and src/hooks/useCharacters.ts
// The hardcoded list below is kept for reference only

/*
export const CHARACTERS: Character[] = [
  // Celebrities - Actors
  {
    id: 'leonardo_dicaprio',
    name: 'Leonardo DiCaprio',
    imageUrl: getCharacterImageUrl('celebrities/actors/leonardo_dicaprio.jpg'),
    category: 'celebrities',
    subcategory: 'actors',
  },
  {
    id: 'tom_hanks',
    name: 'Tom Hanks',
    imageUrl: getCharacterImageUrl('celebrities/actors/tom_hanks.jpg'),
    category: 'celebrities',
    subcategory: 'actors',
  },
  {
    id: 'scarlett_johansson',
    name: 'Scarlett Johansson',
    imageUrl: getCharacterImageUrl('celebrities/actors/scarlett_johansson.jpg'),
    category: 'celebrities',
    subcategory: 'actors',
  },
  {
    id: 'dwayne_johnson',
    name: 'Dwayne Johnson',
    imageUrl: getCharacterImageUrl('celebrities/actors/dwayne_johnson.jpg'),
    category: 'celebrities',
    subcategory: 'actors',
  },

  // Celebrities - Musicians
  {
    id: 'taylor_swift',
    name: 'Taylor Swift',
    imageUrl: getCharacterImageUrl('celebrities/musicians/taylor_swift.jpg'),
    category: 'celebrities',
    subcategory: 'musicians',
  },
  {
    id: 'drake',
    name: 'Drake',
    imageUrl: getCharacterImageUrl('celebrities/musicians/drake.jpg'),
    category: 'celebrities',
    subcategory: 'musicians',
  },
  {
    id: 'beyonce',
    name: 'Beyoncé',
    imageUrl: getCharacterImageUrl('celebrities/musicians/beyonce.jpg'),
    category: 'celebrities',
    subcategory: 'musicians',
  },
  {
    id: 'ed_sheeran',
    name: 'Ed Sheeran',
    imageUrl: getCharacterImageUrl('celebrities/musicians/ed_sheeran.jpg'),
    category: 'celebrities',
    subcategory: 'musicians',
  },

  // Celebrities - Athletes
  {
    id: 'lionel_messi',
    name: 'Lionel Messi',
    imageUrl: getCharacterImageUrl('celebrities/athletes/lionel_messi.jpg'),
    category: 'celebrities',
    subcategory: 'athletes',
  },
  {
    id: 'cristiano_ronaldo',
    name: 'Cristiano Ronaldo',
    imageUrl: getCharacterImageUrl('celebrities/athletes/cristiano_ronaldo.jpg'),
    category: 'celebrities',
    subcategory: 'athletes',
  },
  {
    id: 'lebron_james',
    name: 'LeBron James',
    imageUrl: getCharacterImageUrl('celebrities/athletes/lebron_james.jpg'),
    category: 'celebrities',
    subcategory: 'athletes',
  },
  {
    id: 'serena_williams',
    name: 'Serena Williams',
    imageUrl: getCharacterImageUrl('celebrities/athletes/serena_williams.jpg'),
    category: 'celebrities',
    subcategory: 'athletes',
  },

  // Fictional - Superheroes
  {
    id: 'iron_man',
    name: 'Iron Man',
    imageUrl: getCharacterImageUrl('fictional/superheroes/iron_man.jpg'),
    category: 'fictional',
    subcategory: 'superheroes',
  },
  {
    id: 'spider_man',
    name: 'Spider-Man',
    imageUrl: getCharacterImageUrl('fictional/superheroes/spider_man.jpg'),
    category: 'fictional',
    subcategory: 'superheroes',
  },
  {
    id: 'wonder_woman',
    name: 'Wonder Woman',
    imageUrl: getCharacterImageUrl('fictional/superheroes/wonder_woman.jpg'),
    category: 'fictional',
    subcategory: 'superheroes',
  },
  {
    id: 'batman',
    name: 'Batman',
    imageUrl: getCharacterImageUrl('fictional/superheroes/batman.jpg'),
    category: 'fictional',
    subcategory: 'superheroes',
  },

  // Fictional - Movie Characters
  {
    id: 'jack_sparrow',
    name: 'Jack Sparrow',
    imageUrl: getCharacterImageUrl('fictional/movie_characters/jack_sparrow.jpg'),
    category: 'fictional',
    subcategory: 'movie_characters',
  },
  {
    id: 'harry_potter',
    name: 'Harry Potter',
    imageUrl: getCharacterImageUrl('fictional/movie_characters/harry_potter.jpg'),
    category: 'fictional',
    subcategory: 'movie_characters',
  },
  {
    id: 'darth_vader',
    name: 'Darth Vader',
    imageUrl: getCharacterImageUrl('fictional/movie_characters/darth_vader.jpg'),
    category: 'fictional',
    subcategory: 'movie_characters',
  },
  {
    id: 'joker',
    name: 'The Joker',
    imageUrl: getCharacterImageUrl('fictional/movie_characters/joker.jpg'),
    category: 'fictional',
    subcategory: 'movie_characters',
  },

  // Fictional - Anime
  {
    id: 'goku',
    name: 'Goku',
    imageUrl: getCharacterImageUrl('fictional/anime/goku.jpg'),
    category: 'fictional',
    subcategory: 'anime',
  },
  {
    id: 'naruto',
    name: 'Naruto',
    imageUrl: getCharacterImageUrl('fictional/anime/naruto.jpg'),
    category: 'fictional',
    subcategory: 'anime',
  },
  {
    id: 'luffy',
    name: 'Monkey D. Luffy',
    imageUrl: getCharacterImageUrl('fictional/anime/luffy.jpg'),
    category: 'fictional',
    subcategory: 'anime',
  },
  {
    id: 'sailor_moon',
    name: 'Sailor Moon',
    imageUrl: getCharacterImageUrl('fictional/anime/sailor_moon.jpg'),
    category: 'fictional',
    subcategory: 'anime',
  },

  // Historical - Leaders
  {
    id: 'abraham_lincoln',
    name: 'Abraham Lincoln',
    imageUrl: getCharacterImageUrl('historical/leaders/abraham_lincoln.jpg'),
    category: 'historical',
    subcategory: 'leaders',
  },
  {
    id: 'cleopatra',
    name: 'Cleopatra',
    imageUrl: getCharacterImageUrl('historical/leaders/cleopatra.jpg'),
    category: 'historical',
    subcategory: 'leaders',
  },
  {
    id: 'napoleon',
    name: 'Napoleon Bonaparte',
    imageUrl: getCharacterImageUrl('historical/leaders/napoleon.jpg'),
    category: 'historical',
    subcategory: 'leaders',
  },
  {
    id: 'queen_elizabeth',
    name: 'Queen Elizabeth I',
    imageUrl: getCharacterImageUrl('historical/leaders/queen_elizabeth.jpg'),
    category: 'historical',
    subcategory: 'leaders',
  },

  // Historical - Scientists
  {
    id: 'albert_einstein',
    name: 'Albert Einstein',
    imageUrl: getCharacterImageUrl('historical/scientists/albert_einstein.jpg'),
    category: 'historical',
    subcategory: 'scientists',
  },
  {
    id: 'marie_curie',
    name: 'Marie Curie',
    imageUrl: getCharacterImageUrl('historical/scientists/marie_curie.jpg'),
    category: 'historical',
    subcategory: 'scientists',
  },
  {
    id: 'nikola_tesla',
    name: 'Nikola Tesla',
    imageUrl: getCharacterImageUrl('historical/scientists/nikola_tesla.jpg'),
    category: 'historical',
    subcategory: 'scientists',
  },
  {
    id: 'isaac_newton',
    name: 'Isaac Newton',
    imageUrl: getCharacterImageUrl('historical/scientists/isaac_newton.jpg'),
    category: 'historical',
    subcategory: 'scientists',
  },

  // Historical - Artists
  {
    id: 'leonardo_da_vinci',
    name: 'Leonardo da Vinci',
    imageUrl: getCharacterImageUrl('historical/artists/leonardo_da_vinci.jpg'),
    category: 'historical',
    subcategory: 'artists',
  },
  {
    id: 'vincent_van_gogh',
    name: 'Vincent van Gogh',
    imageUrl: getCharacterImageUrl('historical/artists/vincent_van_gogh.jpg'),
    category: 'historical',
    subcategory: 'artists',
  },
  {
    id: 'frida_kahlo',
    name: 'Frida Kahlo',
    imageUrl: getCharacterImageUrl('historical/artists/frida_kahlo.jpg'),
    category: 'historical',
    subcategory: 'artists',
  },
  {
    id: 'pablo_picasso',
    name: 'Pablo Picasso',
    imageUrl: getCharacterImageUrl('historical/artists/pablo_picasso.jpg'),
    category: 'historical',
    subcategory: 'artists',
  },
];

// Helper functions
export const getCharactersByCategory = (category: CharacterCategory): Character[] => {
  return CHARACTERS.filter(c => c.category === category);
};

export const getCharactersBySubcategory = (category: CharacterCategory, subcategory: string): Character[] => {
  return CHARACTERS.filter(c => c.category === category && c.subcategory === subcategory);
};

export const searchCharacters = (query: string): Character[] => {
  const lowerQuery = query.toLowerCase();
  return CHARACTERS.filter(c => c.name.toLowerCase().includes(lowerQuery));
};
*/
