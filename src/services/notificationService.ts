import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import config from '../utils/config';

type VideoProcessingCallback = (data: {videoId: string}) => void;
type VideoReadyCallback = (data: {
  videoId: string;
  videoUrl: string;
  fileName?: string;
  mimeType?: string;
  durationSeconds?: number;
  thumbnailUrl?: string | null;
}) => void;
type VideoFailedCallback = (data: {
  videoId: string;
  errorMessage?: string;
}) => void;

type ImageProcessingCallback = (data: {photoId: string}) => void;
type ImageReadyCallback = (data: {
  photoId: string;
  imageUrl: string;
  fileName?: string;
  mimeType?: string;
  pendingVideoId?: string;
}) => void;
type ImageFailedCallback = (data: {
  photoId: string;
  errorMessage?: string;
}) => void;

type SynthesizeProcessingCallback = (data: {photoIds: string[]}) => void;
type SynthesizeReadyCallback = (data: {
  images: Array<{photoId: string; imageUrl: string; fileName?: string; mimeType?: string}>;
}) => void;
type SynthesizeFailedCallback = (data: {
  photoIds: string[];
  errorMessage?: string;
}) => void;

type ComicProcessingCallback = (data: {comicId: string}) => void;
type ComicReadyCallback = (data: {
  comicId: string;
  imageUrl: string;
  fileName?: string;
  mimeType?: string;
  thumbnailUrl?: string;
}) => void;
type ComicFailedCallback = (data: {
  comicId: string;
  errorMessage?: string;
}) => void;

class NotificationService {
  private connection: HubConnection | null = null;
  private onProcessing: VideoProcessingCallback | null = null;
  private onReady: VideoReadyCallback | null = null;
  private onFailed: VideoFailedCallback | null = null;
  private onImageProcessing: ImageProcessingCallback | null = null;
  private onImageReady: ImageReadyCallback | null = null;
  private onImageFailed: ImageFailedCallback | null = null;
  private onSynthesizeProcessing: SynthesizeProcessingCallback | null = null;
  private onSynthesizeReady: SynthesizeReadyCallback | null = null;
  private onSynthesizeFailed: SynthesizeFailedCallback | null = null;
  private onComicProcessing: ComicProcessingCallback | null = null;
  private onComicReady: ComicReadyCallback | null = null;
  private onComicFailed: ComicFailedCallback | null = null;

  setEventCallbacks(
    onProcessing: VideoProcessingCallback,
    onReady: VideoReadyCallback,
    onFailed: VideoFailedCallback,
  ) {
    this.onProcessing = onProcessing;
    this.onReady = onReady;
    this.onFailed = onFailed;
  }

  setImageEventCallbacks(
    onProcessing: ImageProcessingCallback,
    onReady: ImageReadyCallback,
    onFailed: ImageFailedCallback,
  ) {
    this.onImageProcessing = onProcessing;
    this.onImageReady = onReady;
    this.onImageFailed = onFailed;
  }

  setSynthesizeEventCallbacks(
    onProcessing: SynthesizeProcessingCallback,
    onReady: SynthesizeReadyCallback,
    onFailed: SynthesizeFailedCallback,
  ) {
    this.onSynthesizeProcessing = onProcessing;
    this.onSynthesizeReady = onReady;
    this.onSynthesizeFailed = onFailed;
  }

  setComicEventCallbacks(
    onProcessing: ComicProcessingCallback,
    onReady: ComicReadyCallback,
    onFailed: ComicFailedCallback,
  ) {
    this.onComicProcessing = onProcessing;
    this.onComicReady = onReady;
    this.onComicFailed = onFailed;
  }

  async connect(accessToken: string): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) {
      console.log('[SignalR] Already connected');
      return;
    }

    try {
      this.connection = new HubConnectionBuilder()
        .withUrl(`${config.apiBaseUrl}/hubs/notifications`, {
          accessTokenFactory: () => accessToken,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Information)
        .build();

      this.registerListeners();

      this.connection.onreconnecting(error => {
        console.log('[SignalR] Reconnecting...', error?.message);
      });

      this.connection.onreconnected(connectionId => {
        console.log('[SignalR] Reconnected:', connectionId);
      });

      this.connection.onclose(error => {
        if (error) {
          // Expected when app goes to background — don't use console.error
          console.log('[SignalR] Connection closed (will reconnect on foreground):', error.message);
        } else {
          console.log('[SignalR] Connection closed');
        }
      });

      await this.connection.start();
      console.log('[SignalR] Connected successfully');
    } catch (error) {
      console.error('[SignalR] Connection failed:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
        console.log('[SignalR] Disconnected');
      } catch (error) {
        console.error('[SignalR] Disconnect error:', error);
      }
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  async reconnectWithNewToken(accessToken: string): Promise<void> {
    await this.disconnect();
    await this.connect(accessToken);
  }

  private registerListeners() {
    if (!this.connection) return;

    this.connection.on('VideoProcessing', (data: {videoId: string}) => {
      console.log('[SignalR] VideoProcessing:', data.videoId);
      this.onProcessing?.(data);
    });

    this.connection.on(
      'VideoReady',
      (data: {
        videoId: string;
        videoUrl: string;
        fileName?: string;
        mimeType?: string;
        durationSeconds?: number;
        thumbnailUrl?: string | null;
      }) => {
        console.log('[SignalR] VideoReady:', data.videoId, 'url:', data.videoUrl);
        // Ensure absolute URL — backend may send a relative path
        const videoUrl =
          data.videoUrl && !data.videoUrl.startsWith('http')
            ? `${config.apiBaseUrl}${data.videoUrl.startsWith('/') ? '' : '/'}${data.videoUrl}`
            : data.videoUrl;
        const thumbnailUrl =
          data.thumbnailUrl && !data.thumbnailUrl.startsWith('http')
            ? `${config.apiBaseUrl}${data.thumbnailUrl.startsWith('/') ? '' : '/'}${data.thumbnailUrl}`
            : data.thumbnailUrl;
        this.onReady?.({...data, videoUrl, thumbnailUrl});
      },
    );

    this.connection.on(
      'VideoFailed',
      (data: {videoId: string; errorMessage?: string}) => {
        console.log('[SignalR] VideoFailed:', data.videoId, data.errorMessage);
        this.onFailed?.(data);
      },
    );

    // Image events
    this.connection.on('ImageProcessing', (data: {photoId: string}) => {
      console.log('[SignalR] ImageProcessing:', data.photoId);
      this.onImageProcessing?.(data);
    });

    this.connection.on(
      'ImageReady',
      (data: {
        photoId: string;
        imageUrl: string;
        fileName?: string;
        mimeType?: string;
        pendingVideoId?: string;
      }) => {
        console.log('[SignalR] ImageReady:', data.photoId, 'url:', data.imageUrl, 'pendingVideoId:', data.pendingVideoId);
        const imageUrl =
          data.imageUrl && !data.imageUrl.startsWith('http')
            ? `${config.apiBaseUrl}${data.imageUrl.startsWith('/') ? '' : '/'}${data.imageUrl}`
            : data.imageUrl;
        this.onImageReady?.({...data, imageUrl});
      },
    );

    this.connection.on(
      'ImageFailed',
      (data: {photoId: string; errorMessage?: string}) => {
        console.log('[SignalR] ImageFailed:', data.photoId, data.errorMessage);
        this.onImageFailed?.(data);
      },
    );

    // Synthesize events
    this.connection.on('SynthesizeProcessing', (data: {photoIds: string[]}) => {
      console.log('[SignalR] SynthesizeProcessing:', data.photoIds);
      this.onSynthesizeProcessing?.(data);
    });

    this.connection.on(
      'SynthesizeReady',
      (data: {
        images: Array<{photoId: string; imageUrl: string; fileName?: string; mimeType?: string}>;
      }) => {
        console.log('[SignalR] SynthesizeReady:', data.images?.length, 'images');
        // Normalize URLs
        const images = (data.images || []).map(img => {
          const imageUrl =
            img.imageUrl && !img.imageUrl.startsWith('http')
              ? `${config.apiBaseUrl}${img.imageUrl.startsWith('/') ? '' : '/'}${img.imageUrl}`
              : img.imageUrl;
          return {...img, imageUrl};
        });
        this.onSynthesizeReady?.({images});
      },
    );

    this.connection.on(
      'SynthesizeFailed',
      (data: {photoIds: string[]; errorMessage?: string}) => {
        console.log('[SignalR] SynthesizeFailed:', data.photoIds, data.errorMessage);
        this.onSynthesizeFailed?.(data);
      },
    );

    // Comic events
    this.connection.on('ComicProcessing', (data: {comicId: string}) => {
      console.log('[SignalR] ComicProcessing:', data.comicId);
      this.onComicProcessing?.(data);
    });

    this.connection.on(
      'ComicReady',
      (data: {
        comicId: string;
        imageUrl: string;
        fileName?: string;
        mimeType?: string;
        thumbnailUrl?: string;
      }) => {
        console.log('[SignalR] ComicReady:', data.comicId, 'url:', data.imageUrl);
        const imageUrl =
          data.imageUrl && !data.imageUrl.startsWith('http')
            ? `${config.apiBaseUrl}${data.imageUrl.startsWith('/') ? '' : '/'}${data.imageUrl}`
            : data.imageUrl;
        const thumbnailUrl =
          data.thumbnailUrl && !data.thumbnailUrl.startsWith('http')
            ? `${config.apiBaseUrl}${data.thumbnailUrl.startsWith('/') ? '' : '/'}${data.thumbnailUrl}`
            : data.thumbnailUrl;
        this.onComicReady?.({...data, imageUrl, thumbnailUrl});
      },
    );

    this.connection.on(
      'ComicFailed',
      (data: {comicId: string; errorMessage?: string}) => {
        console.log('[SignalR] ComicFailed:', data.comicId, data.errorMessage);
        this.onComicFailed?.(data);
      },
    );
  }
}

const notificationService = new NotificationService();
export default notificationService;
