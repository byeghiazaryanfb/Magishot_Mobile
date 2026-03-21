import {config} from '../utils/config';

export interface ComicPanel {
  id: string;
  panelIndex: number;
  text: string;
  phraseType: 'SpeechBubble' | 'Narration' | 'Onomatopoeia' | 'Caption';
}

export interface UserComic {
  id: string;
  fullUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  thumbnailFullUrl: string;
  hasBeenViewed: boolean;
  photoCount: number;
  panels: ComicPanel[];
  createdAt: string;
}

export interface ComicStatus {
  comicId: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  imageUrl: string | null;
  thumbnailFullUrl: string | null;
  errorMessage: string | null;
  panels: ComicPanel[];
}

export interface ComicListResponse {
  comics: UserComic[];
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
}

export interface ComicCategory {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export async function fetchComicCategories(
  accessToken: string,
): Promise<ComicCategory[]> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics/categories`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status}`);
  const data = await response.json();
  return data.categories ?? [];
}

export async function generateComic(
  images: Array<{uri: string; type?: string; fileName?: string}>,
  accessToken: string,
  categoryId?: string,
): Promise<{comicId: string; status: string; message: string}> {
  const formData = new FormData();
  images.forEach((img, index) => {
    formData.append('images', {
      uri: img.uri,
      type: img.type || 'image/jpeg',
      name: img.fileName || `photo_${index + 1}.jpg`,
    } as any);
  });
  if (categoryId) {
    formData.append('categoryId', categoryId);
  }

  const response = await fetch(`${config.apiBaseUrl}/api/Comics/generate`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let message = 'Failed to generate comic';
    try {
      const parsed = JSON.parse(errorText);
      message = parsed?.message || `Server error: ${response.status}`;
    } catch {
      message = errorText || `Server error: ${response.status}`;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchMyComics(
  accessToken: string,
  cursor?: string,
  pageSize = 20,
): Promise<ComicListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('pageSize', String(pageSize));

  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics?${params.toString()}`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!response.ok) throw new Error(`Failed to fetch comics: ${response.status}`);
  return response.json();
}

export async function fetchComic(
  comicId: string,
  accessToken: string,
): Promise<UserComic> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics/${comicId}`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!response.ok) throw new Error(`Failed to fetch comic: ${response.status}`);
  return response.json();
}

export async function fetchComicStatus(
  comicId: string,
  accessToken: string,
): Promise<ComicStatus> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics/${comicId}/status`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!response.ok) throw new Error(`Failed to fetch comic status: ${response.status}`);
  return response.json();
}

export async function editPanel(
  comicId: string,
  panelId: string,
  text: string,
  accessToken: string,
): Promise<UserComic> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics/${comicId}/panels/${panelId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({text}),
    },
  );

  if (!response.ok) throw new Error(`Failed to edit panel: ${response.status}`);
  return response.json();
}

export async function editPanels(
  comicId: string,
  panels: Array<{panelId: string; text: string}>,
  accessToken: string,
): Promise<UserComic> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics/${comicId}/panels`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({panels}),
    },
  );

  if (!response.ok) throw new Error(`Failed to edit panels: ${response.status}`);
  return response.json();
}

export async function markComicViewed(
  comicId: string,
  accessToken: string,
): Promise<void> {
  await fetch(`${config.apiBaseUrl}/api/Comics/${comicId}/viewed`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`},
  });
}

export async function deleteComic(
  comicId: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(
    `${config.apiBaseUrl}/api/Comics/${comicId}`,
    {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!response.ok) throw new Error(`Failed to delete comic: ${response.status}`);
}
