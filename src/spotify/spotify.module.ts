import { Module } from '@nestjs/common';

import { DrizzleModule } from 'src/providers/drizzle.provider';
import { SpotifyController } from 'src/spotify/spotify.controller';
import { SpotifyService } from 'src/spotify/spotify.service';

@Module({
  imports: [DrizzleModule],
  controllers: [SpotifyController],
  providers: [SpotifyService],
})
export class SpotifyModule {}
