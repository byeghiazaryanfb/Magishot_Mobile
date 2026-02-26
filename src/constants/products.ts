/**
 * Product library for Virtual Try-On feature
 */

export interface ProductCategory {
  id: string;
  label: string;
  icon: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  thumbnail?: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {id: 'sunglasses', label: 'Sunglasses', icon: 'glasses-outline'},
  {id: 'hats', label: 'Hats', icon: 'baseball-outline'},
  {id: 'jewelry', label: 'Jewelry', icon: 'diamond-outline'},
  {id: 'watches', label: 'Watches', icon: 'watch-outline'},
  {id: 'clothing', label: 'Clothing', icon: 'shirt-outline'},
  {id: 'shoes', label: 'Shoes', icon: 'footsteps-outline'},
];

export const SAMPLE_PRODUCTS: Product[] = [
  // Sunglasses
  {
    id: 'aviator_classic',
    name: 'Classic Aviator',
    category: 'sunglasses',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400',
  },
  {
    id: 'wayfarers',
    name: 'Wayfarers',
    category: 'sunglasses',
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400',
  },
  {
    id: 'round_vintage',
    name: 'Round Vintage',
    category: 'sunglasses',
    imageUrl: 'https://images.unsplash.com/photo-1577803645773-f96470509666?w=400',
  },
  {
    id: 'cat_eye',
    name: 'Cat Eye',
    category: 'sunglasses',
    imageUrl: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=400',
  },
  {
    id: 'oversized',
    name: 'Oversized',
    category: 'sunglasses',
    imageUrl: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=400',
  },

  // Hats
  {
    id: 'fedora',
    name: 'Fedora',
    category: 'hats',
    imageUrl: 'https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400',
  },
  {
    id: 'baseball_cap',
    name: 'Baseball Cap',
    category: 'hats',
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400',
  },
  {
    id: 'beanie',
    name: 'Beanie',
    category: 'hats',
    imageUrl: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=400',
  },
  {
    id: 'sun_hat',
    name: 'Sun Hat',
    category: 'hats',
    imageUrl: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=400',
  },
  {
    id: 'cowboy_hat',
    name: 'Cowboy Hat',
    category: 'hats',
    imageUrl: 'https://images.unsplash.com/photo-1529958030586-3aae4ca485ff?w=400',
  },

  // Jewelry
  {
    id: 'gold_necklace',
    name: 'Gold Necklace',
    category: 'jewelry',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400',
  },
  {
    id: 'pearl_earrings',
    name: 'Pearl Earrings',
    category: 'jewelry',
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400',
  },
  {
    id: 'diamond_ring',
    name: 'Diamond Ring',
    category: 'jewelry',
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400',
  },
  {
    id: 'silver_bracelet',
    name: 'Silver Bracelet',
    category: 'jewelry',
    imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400',
  },
  {
    id: 'pendant',
    name: 'Pendant',
    category: 'jewelry',
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400',
  },

  // Watches
  {
    id: 'luxury_gold',
    name: 'Luxury Gold',
    category: 'watches',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
  },
  {
    id: 'smart_watch',
    name: 'Smart Watch',
    category: 'watches',
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400',
  },
  {
    id: 'classic_leather',
    name: 'Classic Leather',
    category: 'watches',
    imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400',
  },
  {
    id: 'sport_watch',
    name: 'Sport Watch',
    category: 'watches',
    imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    category: 'watches',
    imageUrl: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=400',
  },

  // Clothing
  {
    id: 'red_dress',
    name: 'Red Dress',
    category: 'clothing',
    imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400',
  },
  {
    id: 'denim_jacket',
    name: 'Denim Jacket',
    category: 'clothing',
    imageUrl: 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400',
  },
  {
    id: 'blazer',
    name: 'Blazer',
    category: 'clothing',
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400',
  },
  {
    id: 'leather_jacket',
    name: 'Leather Jacket',
    category: 'clothing',
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
  },
  {
    id: 'floral_blouse',
    name: 'Floral Blouse',
    category: 'clothing',
    imageUrl: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400',
  },

  // Shoes
  {
    id: 'sneakers',
    name: 'Sneakers',
    category: 'shoes',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
  },
  {
    id: 'heels',
    name: 'High Heels',
    category: 'shoes',
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400',
  },
  {
    id: 'boots',
    name: 'Boots',
    category: 'shoes',
    imageUrl: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400',
  },
  {
    id: 'loafers',
    name: 'Loafers',
    category: 'shoes',
    imageUrl: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400',
  },
  {
    id: 'sandals',
    name: 'Sandals',
    category: 'shoes',
    imageUrl: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400',
  },
];

export const getProductsByCategory = (category: string): Product[] => {
  return SAMPLE_PRODUCTS.filter(product => product.category === category);
};

export const getProductById = (id: string): Product | undefined => {
  return SAMPLE_PRODUCTS.find(product => product.id === id);
};
