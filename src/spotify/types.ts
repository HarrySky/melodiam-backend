import type { Image } from '@spotify/web-api-ts-sdk';

export type CurrentUser = {
  id: string;
  displayName: string | null;
  photos: Image[];
  externalUrl: string;
};

export type MelodiamContext = {
  name: string;
  externalUrl: string;
  type: 'artist' | 'playlist' | 'album' | 'liked_songs' | 'unknown';
};

type Artist = {
  name: string;
  externalUrl: string;
};

type Album = {
  name: string;
  externalUrl: string;
};

export type CurrentSong = {
  name: string;
  duration: number;
  genres: string[];
  artists: Artist[];
  album: Album;
  context: MelodiamContext;
  isPlaying: boolean;
  listenedFor: number;
};

export type HistoryItem = {
  name: string;
  duration: number;
  genres: string[];
  artistNames: string[];
  albumName: string;
  context: MelodiamContext;
  listenedFor: number;
  addedAt: Date;
};
