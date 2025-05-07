import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import type { Context, PlaybackState, Track } from '@spotify/web-api-ts-sdk';
import { CronJob } from 'cron';
import { desc, eq, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';

import * as schema from 'src/db/schema';
import { users, history } from 'src/db/schema';
import { DrizzleAsyncProvider } from 'src/providers/drizzle.provider';
import { MelodiamAccessTokenStrategy } from 'src/spotify/strategy';
import type {
  CurrentSong,
  MelodiamContext,
  CurrentUser,
  HistoryItem,
} from 'src/spotify/types';

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);

  private readonly appToken: string;
  // Database prepared statements
  private readonly psGetLatestHistoryByUserId;
  private readonly psGetLastLoggedInUser;

  private sdk: SpotifyApi | null = null;
  private userId: number | null = null;
  private refreshToken: string | null = null;
  private currentUser: CurrentUser | null = null;
  private currentSong: CurrentSong | null = null;
  private currentSongState: PlaybackState | null = null;
  private currentContext: MelodiamContext | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(DrizzleAsyncProvider)
    private readonly db: BunSQLDatabase<typeof schema>,
  ) {
    const clientId = this.configService.getOrThrow<string>('spotify.clientId');
    const clientSecret = this.configService.getOrThrow<string>('spotify.clientSecret');
    this.appToken = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    this.psGetLatestHistoryByUserId = db
      .select({
        name: history.trackName,
        duration: history.trackDuration,
        genres: history.trackGenres,
        artistNames: history.artistNames,
        albumName: history.albumName,
        context: history.context,
        listenedFor: history.listenedFor,
        addedAt: history.addedAt,
      })
      .from(history)
      .where(eq(history.userId, sql.placeholder('userId')))
      .orderBy(desc(history.addedAt))
      .limit(10)
      .prepare('get_latest_history_by_user_id');
    this.psGetLastLoggedInUser = db
      .select({
        id: users.id,
        accessToken: users.accessToken,
        refreshToken: users.refreshToken,
        expiresAt: users.expiresAt,
      })
      .from(users)
      .orderBy(desc(users.lastLoginAt))
      .limit(1)
      .prepare('get_last_logged_in_user');

    const updateLastLoggedInUserJob = new CronJob(
      // Run every minute at 7, 27 and 47 seconds (every 20 seconds essentially)
      '7,27,47 * * * * *',
      () => this.updateLastLoggedInUser(),
      null,
      false, // start
      'Europe/Tallinn',
      null,
      false, // runOnInit
      null,
      null,
      true, // waitForCompletion
    );
    this.schedulerRegistry.addCronJob(
      'updateLastLoggedInUser',
      updateLastLoggedInUserJob,
    );
    updateLastLoggedInUserJob.start();
  }

  // ENDPOINTS IMPLEMENTATION:

  getUserEndpoint() {
    return this.currentUser;
  }

  getCurrentSongEndpoint(): CurrentSong | null {
    return this.currentSong;
  }

  async getLatestHistoryEndpoint(): Promise<HistoryItem[] | null> {
    if (!this.userId) {
      return null;
    }

    return await this.psGetLatestHistoryByUserId.execute({ userId: this.userId });
  }

  // SCHEDULED TASKS:

  // eslint-disable-next-line complexity
  async updateLastLoggedInUser() {
    const [lastLoggedInUser] = await this.psGetLastLoggedInUser.execute();
    if (!lastLoggedInUser) {
      return;
    }

    // No need to create SDK again if nothing changed
    if (
      this.sdk &&
      lastLoggedInUser.id === this.userId &&
      lastLoggedInUser.refreshToken === this.refreshToken
    ) {
      return;
    }

    this.logger.warn('Last logged-in user changed');
    if (this.schedulerRegistry.doesExist('cron', 'updateCurrentSongState')) {
      this.schedulerRegistry.deleteCronJob('updateCurrentSongState');
    }

    const userRow = {
      accessToken: lastLoggedInUser.accessToken!,
      refreshToken: lastLoggedInUser.refreshToken!,
      expiresAt: lastLoggedInUser.expiresAt!,
    };
    const strategy = MelodiamAccessTokenStrategy.fromDatabaseUser(
      this.appToken,
      userRow,
    );
    this.sdk = new SpotifyApi(strategy);
    const user = await this.sdk.currentUser.profile();
    this.currentUser = {
      id: user.id,
      displayName: user.display_name,
      photos: user.images,
      externalUrl: user.external_urls.spotify,
    };
    this.userId = lastLoggedInUser.id;
    this.refreshToken = lastLoggedInUser.refreshToken;
    this.currentSong = null;
    this.currentSongState = null;
    this.currentContext = null;

    const updateCurrentSongStateJob = new CronJob(
      // Run every 2 seconds
      '*/2 * * * * *',
      () => this.updateCurrentSongState(),
      null,
      false, // start
      'Europe/Tallinn',
      null,
      false, // runOnInit
      null,
      null,
      true, // waitForCompletion
    );
    this.schedulerRegistry.addCronJob(
      'updateCurrentSongState',
      updateCurrentSongStateJob,
    );
    updateCurrentSongStateJob.start();
  }

  // eslint-disable-next-line complexity
  async updateCurrentSongState() {
    if (!this.sdk) {
      return;
    }

    const previousSongState = this.currentSongState;
    let newSongState: PlaybackState | null = null;
    try {
      newSongState = await this.sdk.player.getCurrentlyPlayingTrack();
    } catch (err) {
      // TODO: return on timeouts
      const error = err as Error;
      this.logger.error(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        'Failed to get currently playing track',
      );
    }

    // Filter out non-tracks and local tracks
    if (
      !newSongState ||
      newSongState.currently_playing_type !== 'track' ||
      (newSongState.item as Track).is_local
    ) {
      this.currentSongState = null;
      // Nothing is playing right now, but was playing before
      if (previousSongState !== null) {
        await this.handleStoppedListening(previousSongState);
      }

      return;
    }

    await this.processCurrentSong(previousSongState, newSongState);
    this.currentSongState = newSongState;
  }

  // FUNCTIONS FOR SCHEDULED TASKS:

  async addSongToHistory(userId: number, trackId: string, currentSong: CurrentSong) {
    await this.db.insert(history).values({
      userId: userId,
      trackId: trackId,
      trackName: currentSong.name,
      trackDuration: currentSong.duration,
      trackGenres: currentSong.genres,
      artistNames: currentSong.artists.map((artist) => artist.name),
      albumName: currentSong.album.name,
      context: currentSong.context,
      listenedFor: currentSong.listenedFor,
    });
    this.logger.log('Added song to user history');
  }

  async setNewCurrentSong(newSongState: PlaybackState) {
    const track = newSongState.item as Track;
    const fullArtists = await this.sdk!.artists.get(
      track.artists.map((artist) => artist.id),
    );
    const genres = new Set(fullArtists.flatMap((artist) => artist.genres));
    this.currentSong = {
      name: track.name,
      duration: Math.floor(track.duration_ms / 1000),
      genres: Array.from(genres),
      artists: track.artists.map((artist) => {
        return { name: artist.name, externalUrl: artist.external_urls.spotify };
      }),
      album: {
        name: track.album.name,
        externalUrl: track.album.external_urls.spotify,
      },
      context: this.currentContext!,
      isPlaying: newSongState.is_playing,
      listenedFor: 0,
    };
  }

  async handleStoppedListening(previousSongState: PlaybackState) {
    if (this.currentSong!.listenedFor >= 30) {
      await this.addSongToHistory(
        this.userId!,
        previousSongState.item.id,
        this.currentSong!,
      );
    }

    this.currentSong = null;
    this.currentContext = null;
    this.logger.log('User stopped listening to music');
  }

  areSameContexts(
    previousContext: Context | null,
    newContext: Context | null,
  ): boolean {
    if (previousContext === null || newContext === null) {
      return previousContext === newContext;
    }

    return previousContext.external_urls.spotify === newContext.external_urls.spotify;
  }

  // eslint-disable-next-line complexity
  async processSongContext(songState: PlaybackState): Promise<MelodiamContext> {
    const context = songState.context;
    // This probably means user is listening from "Liked Songs"
    if (!context || context.type === 'collection') {
      return {
        name: 'Liked Songs',
        externalUrl: '#',
        type: 'liked_songs',
      };
    }

    const track = songState.item as Track;
    if (context.type === 'artist') {
      const firstArtist = track.artists[0]!;
      return {
        name: firstArtist.name,
        externalUrl: firstArtist.external_urls.spotify,
        type: 'artist',
      };
    } else if (context.type === 'album') {
      const album = track.album;
      return {
        name: album.name,
        externalUrl: album.external_urls.spotify,
        type: 'album',
      };
    } else if (context.type === 'playlist') {
      const uriElements = context.uri.split(':');
      const playlistId = uriElements[uriElements.length - 1]!;
      const playlist = await this.sdk!.playlists.getPlaylist(
        playlistId,
        undefined,
        'name,external_urls',
      );
      return {
        name: playlist.name,
        externalUrl: playlist.external_urls.spotify,
        type: 'playlist',
      };
    }

    this.logger.error(`Cannot process context type ${context.type}`);
    return {
      name: 'Unknown Context',
      externalUrl: '#',
      type: 'unknown',
    };
  }

  async handleStartedListening(newSongState: PlaybackState) {
    this.currentContext = await this.processSongContext(newSongState);
    await this.setNewCurrentSong(newSongState);
    this.logger.log('User started listening to music');
  }

  async handleSameSong(previousSongState: PlaybackState, newSongState: PlaybackState) {
    // Add to `listenedFor` only if song is not paused
    if (newSongState.is_playing) {
      this.currentSong!.listenedFor += 2;
    }

    if (newSongState.is_playing !== previousSongState.is_playing) {
      this.currentSong!.isPlaying = newSongState.is_playing;
      this.logger.log(`User ${newSongState.is_playing ? 'un' : ''}paused current song`);
    }
  }

  async handleChangedSong(
    previousSongState: PlaybackState,
    newSongState: PlaybackState,
  ) {
    // Different track was playing before for at least 30 seconds
    if (this.currentSong!.listenedFor >= 30) {
      await this.addSongToHistory(
        this.userId!,
        previousSongState.item.id,
        this.currentSong!,
      );
    }

    if (!this.areSameContexts(previousSongState.context, newSongState.context)) {
      this.currentContext = await this.processSongContext(newSongState);
    }

    await this.setNewCurrentSong(newSongState);
    this.logger.log('User changed song');
  }

  async processCurrentSong(
    previousSongState: PlaybackState | null,
    newSongState: PlaybackState,
  ) {
    // Nothing was playing before
    if (previousSongState === null) {
      await this.handleStartedListening(newSongState);
      return;
    }

    // Same track was playing before
    if (newSongState.item.id === previousSongState.item.id) {
      await this.handleSameSong(previousSongState, newSongState);
      return;
    }

    // Different track was playing before
    await this.handleChangedSong(previousSongState, newSongState);
  }
}
