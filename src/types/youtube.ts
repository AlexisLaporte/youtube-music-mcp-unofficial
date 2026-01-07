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

// ============ Nouveau modèle relationnel ============

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail?: string;
  isLiked: boolean;
  playlistIds: string[];
  addedAt?: string;
  /** User marked this song as intentionally not belonging to any playlist */
  noPlaylistNeeded?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  privacy: 'public' | 'private' | 'unlisted';
  publishedAt?: string;
}

// ============ Ancien modèle (deprecated) ============

/** @deprecated Use Playlist instead */
export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  trackCount: number;
  privacy: 'public' | 'private' | 'unlisted';
  publishedAt?: string;
}

/** @deprecated Use Song instead */
export interface YouTubeTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail?: string;
  videoId: string;
  addedAt?: string;
}

export interface PlaylistSuggestion {
  playlist: YouTubePlaylist;
  score: number;
  reasons: string[];
}

export interface PlaylistAnalysis {
  likedSongs: YouTubeTrack[];
  crossReferences: {
    track: YouTubeTrack;
    foundInPlaylists: {
      playlist: YouTubePlaylist;
      position: number;
    }[];
    suggestedPlaylists: PlaylistSuggestion[];
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