import api from './api';

// Types for User Photos API
export interface UserPhoto {
  id: string;
  relativeUrl: string;
  fullUrl: string;
  originalImageRelativeUrl: string | null;
  originalImageFullUrl: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  prompt: string | null;
  generationType: string;
  status: string;
  errorMessage?: string | null;
  hasBeenViewed: boolean;
  createdAt: string;
}

export interface UserPhotosResponse {
  photos: UserPhoto[];
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
}

export interface DeleteAllPhotosResponse {
  deletedCount: number;
  message: string;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Get user's photos with infinite scroll pagination
 * @param accessToken - The user's access token for authentication
 * @param cursor - Optional cursor (datetime) for pagination
 * @param pageSize - Number of items per page (default: 20)
 */
export const getUserPhotos = async (
  accessToken: string,
  cursor?: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<UserPhotosResponse> => {
  try {
    const params = new URLSearchParams();
    params.append('pageSize', pageSize.toString());
    if (cursor) {
      params.append('cursor', cursor);
    }

    const response = await api.get<UserPhotosResponse>(`/api/UserPhotos?${params.toString()}`, accessToken);
    return response;
  } catch (error) {
    console.error('Error fetching user photos:', error);
    throw error;
  }
};

/**
 * Delete a single photo by ID
 * @param accessToken - The user's access token for authentication
 * @param photoId - The ID of the photo to delete
 */
export const deleteUserPhoto = async (accessToken: string, photoId: string): Promise<void> => {
  try {
    await api.delete(`/api/UserPhotos/${photoId}`, accessToken);
  } catch (error) {
    console.error('Error deleting user photo:', error);
    throw error;
  }
};

/**
 * Mark a photo as opened on the backend
 * @param accessToken - The user's access token for authentication
 * @param photoId - The ID of the photo to mark as opened
 */
export const markPhotoOpened = async (accessToken: string, photoId: string): Promise<void> => {
  try {
    await api.patch(`/api/UserPhotos/${photoId}/viewed`, undefined, accessToken);
  } catch (error) {
    console.error('Error marking photo as opened:', error);
  }
};

/**
 * Delete all user's photos
 * @param accessToken - The user's access token for authentication
 */
export const deleteAllUserPhotos = async (accessToken: string): Promise<DeleteAllPhotosResponse> => {
  try {
    const response = await api.delete<DeleteAllPhotosResponse>('/api/UserPhotos', accessToken);
    return response;
  } catch (error) {
    console.error('Error deleting all user photos:', error);
    throw error;
  }
};

export default {
  getUserPhotos,
  deleteUserPhoto,
  markPhotoOpened,
  deleteAllUserPhotos,
};
