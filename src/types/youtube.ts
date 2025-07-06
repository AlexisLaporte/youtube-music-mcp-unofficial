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

export interface YouTubeTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail?: string;
  videoId: string;
  addedAt?: string;
}

export interface PlaylistAnalysis {
  likedSongs: YouTubeTrack[];
  crossReferences: {
    track: YouTubeTrack;
    foundInPlaylists: {
      playlist: YouTubePlaylist;
      position: number;
    }[];
  }[];
  statistics: {
    totalLikedSongs: number;
    songsFoundInPlaylists: number;
    songsNotFoundInPlaylists: number;
    mostCommonPlaylists: {
      playlist: YouTubePlaylist;
      songCount: number;
    }[];
  };
}