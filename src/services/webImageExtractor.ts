/**
 * Service to extract images from a webpage URL
 */

export interface ExtractedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface WebImageExtractionResult {
  success: boolean;
  images: ExtractedImage[];
  error?: string;
  pageTitle?: string;
}

/**
 * Extract images from a webpage URL
 * Fetches the HTML and parses it to find image URLs
 */
export async function extractImagesFromUrl(
  pageUrl: string,
): Promise<WebImageExtractionResult> {
  try {
    // Validate URL
    if (!pageUrl.startsWith('http://') && !pageUrl.startsWith('https://')) {
      return {
        success: false,
        images: [],
        error: 'Invalid URL. Please enter a URL starting with http:// or https://',
      };
    }

    // Fetch the webpage HTML
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        images: [],
        error: `Failed to fetch page: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Use the page URL string for resolving relative paths
    const baseUrlString = pageUrl;

    // Parse page title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract images using regex patterns
    const images: ExtractedImage[] = [];
    const seenUrls = new Set<string>();

    // Pattern 1: Standard <img> tags
    const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgTagRegex.exec(html)) !== null) {
      const src = match[1];
      const fullUrl = resolveUrl(src, baseUrlString);
      if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
        seenUrls.add(fullUrl);
        // Try to extract alt text
        const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
        images.push({
          url: fullUrl,
          alt: altMatch ? altMatch[1] : undefined,
        });
      }
    }

    // Pattern 2: data-src (lazy loaded images)
    const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
    while ((match = dataSrcRegex.exec(html)) !== null) {
      const src = match[1];
      const fullUrl = resolveUrl(src, baseUrlString);
      if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
        seenUrls.add(fullUrl);
        images.push({url: fullUrl});
      }
    }

    // Pattern 3: srcset attribute (responsive images)
    const srcsetRegex = /srcset=["']([^"']+)["']/gi;
    while ((match = srcsetRegex.exec(html)) !== null) {
      const srcset = match[1];
      // Parse srcset - format: "url1 1x, url2 2x" or "url1 300w, url2 600w"
      const srcsetParts = srcset.split(',');
      for (const part of srcsetParts) {
        const urlPart = part.trim().split(/\s+/)[0];
        if (urlPart) {
          const fullUrl = resolveUrl(urlPart, baseUrlString);
          if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
            seenUrls.add(fullUrl);
            images.push({url: fullUrl});
          }
        }
      }
    }

    // Pattern 4: Open Graph / meta images
    const ogImageRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
    while ((match = ogImageRegex.exec(html)) !== null) {
      const fullUrl = resolveUrl(match[1], baseUrlString);
      if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
        seenUrls.add(fullUrl);
        images.push({url: fullUrl, alt: 'Product Image'});
      }
    }

    // Pattern 5: Background images in style attributes
    const bgImageRegex = /background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
    while ((match = bgImageRegex.exec(html)) !== null) {
      const fullUrl = resolveUrl(match[1], baseUrlString);
      if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
        seenUrls.add(fullUrl);
        images.push({url: fullUrl});
      }
    }

    // Pattern 6: JSON-LD structured data (common for e-commerce)
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);
        extractImagesFromJsonLd(jsonData, images, seenUrls, baseUrlString);
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Filter out small images (likely icons/logos) and sort by likely product relevance
    const filteredImages = images.filter(img => {
      const url = img.url.toLowerCase();
      // Exclude common non-product patterns
      if (
        url.includes('logo') ||
        url.includes('icon') ||
        url.includes('sprite') ||
        url.includes('pixel') ||
        url.includes('tracking') ||
        url.includes('analytics') ||
        url.includes('avatar') ||
        url.includes('placeholder') ||
        url.includes('loading') ||
        url.includes('spinner') ||
        url.includes('1x1') ||
        url.includes('spacer')
      ) {
        return false;
      }
      return true;
    });

    // Sort to prioritize likely product images
    const sortedImages = filteredImages.sort((a, b) => {
      const scoreA = getImageRelevanceScore(a);
      const scoreB = getImageRelevanceScore(b);
      return scoreB - scoreA;
    });

    // Limit to reasonable number
    const limitedImages = sortedImages.slice(0, 50);

    if (limitedImages.length === 0) {
      return {
        success: false,
        images: [],
        error: 'No product images found on this page',
        pageTitle,
      };
    }

    return {
      success: true,
      images: limitedImages,
      pageTitle,
    };
  } catch (error) {
    console.error('Web image extraction error:', error);
    return {
      success: false,
      images: [],
      error: error instanceof Error ? error.message : 'Failed to extract images',
    };
  }
}

/**
 * Resolve a potentially relative URL to an absolute URL
 */
function resolveUrl(src: string, baseUrlString: string): string | null {
  try {
    // Handle data URLs
    if (src.startsWith('data:')) {
      return null; // Skip data URLs
    }

    // Handle protocol-relative URLs
    if (src.startsWith('//')) {
      return `https:${src}`;
    }

    // Handle absolute URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }

    // Handle relative URLs - extract origin from base URL string
    const match = baseUrlString.match(/^(https?:\/\/[^\/]+)/);
    if (!match) {
      return null;
    }
    const origin = match[1];

    // Handle root-relative URLs
    if (src.startsWith('/')) {
      return `${origin}${src}`;
    }

    // Handle relative URLs (no leading /)
    const pathMatch = baseUrlString.match(/^(https?:\/\/[^\/]+)(\/.*\/)?/);
    if (pathMatch) {
      const basePath = pathMatch[2] || '/';
      return `${origin}${basePath}${src}`;
    }

    return `${origin}/${src}`;
  } catch {
    return null;
  }
}

/**
 * Check if a URL looks like a valid image URL
 */
function isValidImageUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();

  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
  const hasImageExtension = imageExtensions.some(ext =>
    lowercaseUrl.includes(ext),
  );

  // Also allow URLs that might be dynamic image servers
  const isDynamicImageUrl =
    lowercaseUrl.includes('/image') ||
    lowercaseUrl.includes('/img') ||
    lowercaseUrl.includes('/photo') ||
    lowercaseUrl.includes('/product') ||
    lowercaseUrl.includes('/media') ||
    lowercaseUrl.includes('cdn') ||
    lowercaseUrl.includes('cloudinary') ||
    lowercaseUrl.includes('imgix') ||
    lowercaseUrl.includes('shopify') ||
    lowercaseUrl.includes('amazon') ||
    lowercaseUrl.includes('ebay');

  return hasImageExtension || isDynamicImageUrl;
}

/**
 * Extract images from JSON-LD structured data
 */
function extractImagesFromJsonLd(
  data: any,
  images: ExtractedImage[],
  seenUrls: Set<string>,
  baseUrlString: string,
): void {
  if (!data) return;

  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      extractImagesFromJsonLd(item, images, seenUrls, baseUrlString);
    }
    return;
  }

  // Handle objects
  if (typeof data === 'object') {
    // Look for image property
    if (data.image) {
      const imageUrls = Array.isArray(data.image) ? data.image : [data.image];
      for (const img of imageUrls) {
        const url = typeof img === 'string' ? img : img?.url;
        if (url) {
          const fullUrl = resolveUrl(url, baseUrlString);
          if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
            seenUrls.add(fullUrl);
            images.push({
              url: fullUrl,
              alt: data.name || 'Product',
            });
          }
        }
      }
    }

    // Recursively check nested objects
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'object') {
        extractImagesFromJsonLd(data[key], images, seenUrls, baseUrlString);
      }
    }
  }
}

/**
 * Score an image by likely relevance to be a product image
 */
function getImageRelevanceScore(img: ExtractedImage): number {
  let score = 0;
  const url = img.url.toLowerCase();

  // Boost for product-related keywords
  if (url.includes('product')) score += 10;
  if (url.includes('item')) score += 8;
  if (url.includes('main')) score += 5;
  if (url.includes('large')) score += 5;
  if (url.includes('zoom')) score += 5;
  if (url.includes('detail')) score += 5;
  if (url.includes('primary')) score += 5;
  if (url.includes('hero')) score += 3;

  // Boost for larger size indicators
  if (url.includes('1000') || url.includes('1024') || url.includes('1200')) score += 5;
  if (url.includes('800') || url.includes('768')) score += 3;

  // Alt text relevance
  if (img.alt && img.alt.length > 5) score += 3;

  // Penalize thumbnail indicators
  if (url.includes('thumb')) score -= 5;
  if (url.includes('small')) score -= 5;
  if (url.includes('mini')) score -= 5;
  if (url.includes('50x') || url.includes('100x') || url.includes('150x')) score -= 5;

  return score;
}
