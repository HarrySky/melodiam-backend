import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SpotifyService } from 'src/spotify/spotify.service';
import type { CurrentSong, CurrentUser, HistoryItem } from 'src/spotify/types';

@ApiTags('Spotify')
@Controller('spotify')
export class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) {}

  @Get('user')
  getUser(): CurrentUser | null {
    return this.spotifyService.getUserEndpoint();
  }

  @Get('current_song')
  getCurrentSong(): CurrentSong | null {
    return this.spotifyService.getCurrentSongEndpoint();
  }

  @Get('latest_history')
  async getLatestHistory(): Promise<HistoryItem[] | null> {
    return await this.spotifyService.getLatestHistoryEndpoint();
  }
}
