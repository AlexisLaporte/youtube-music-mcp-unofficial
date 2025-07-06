export interface AuthStatus {
  isConnected: boolean;
  user?: {
    name: string;
    email: string;
    profilePicture?: string;
  };
  connectedAt?: string;
  error?: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  trackCount: number;
  privacy: 'public' | 'private' | 'unlisted';
  publishedAt?: string;
}