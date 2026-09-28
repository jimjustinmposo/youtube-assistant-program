import { ComposioClient } from './ComposioClient.js';

/**
 * Isolate every YouTube interaction behind this service.
 *
 * Phase 1 implements NO YouTube functionality. There is no Composio SDK
 * dependency yet, no OAuth flow, no upload capability, and no code path that
 * can publish anything. React components must never call Composio directly -
 * they go through the local API, which goes through this service.
 *
 * Phase 5 will add: connect() and getChannel().
 * Phase 6 will add: uploadVideo(), setThumbnail(), updateVideo(), getVideo(),
 * disconnect() - each guarded by an independent approval check.
 */
export interface YouTubeConnectionState {
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
  accountEmail: string | null;
}

export interface YouTubeUploadRequest {
  projectId: string;
  videoPath: string;
  thumbnailPath: string | null;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: 'private' | 'unlisted' | 'public';
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
}

export class ComposioYouTubeService {
  constructor(private readonly client: ComposioClient) {}

  /** Phase 1: always reports "not connected" because nothing is implemented. */
  async getConnectionState(): Promise<YouTubeConnectionState> {
    return { connected: false, channelId: null, channelTitle: null, accountEmail: null };
  }

  async connect(): Promise<never> {
    throw new Error('YouTube connection is not available yet. It will be implemented in Phase 5.');
  }

  async disconnect(): Promise<never> {
    throw new Error('YouTube disconnect is not available yet. It will be implemented in Phase 5.');
  }

  async getChannel(): Promise<never> {
    throw new Error('YouTube channel lookup is not available yet. It will be implemented in Phase 5.');
  }

  async uploadVideo(_request: YouTubeUploadRequest): Promise<never> {
    throw new Error('YouTube upload is not available yet. It will be implemented in Phase 6.');
  }

  async setThumbnail(): Promise<never> {
    throw new Error('Thumbnail upload is not available yet. It will be implemented in Phase 6.');
  }

  async updateVideo(): Promise<never> {
    throw new Error('Video metadata updates are not available yet. They will be implemented in Phase 6.');
  }

  async getVideo(): Promise<never> {
    throw new Error('YouTube video lookup is not available yet. It will be implemented in Phase 6.');
  }
}
