import { timingSafeEqual } from 'crypto';

import { Inject, Injectable, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { eq, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import type { Response } from 'express';
import { v4 } from 'uuid';

import * as schema from 'src/db/schema';
import { users } from 'src/db/schema';
import { DrizzleAsyncProvider } from 'src/providers/drizzle.provider';
import { OAUTH_AUTHORIZE_URL } from 'src/spotify/constants';
import { MelodiamAccessTokenStrategy } from 'src/spotify/strategy';

@Injectable()
export class AuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUrl: string;
  private readonly mainUserSecret: string;

  private readonly appToken: string;
  // Database prepared statements
  private readonly psGetUserBySpotifyUserId;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DrizzleAsyncProvider)
    private readonly db: BunSQLDatabase<typeof schema>,
  ) {
    this.clientId = this.configService.getOrThrow<string>('spotify.clientId');
    this.clientSecret = this.configService.getOrThrow<string>('spotify.clientSecret');
    this.redirectUrl = this.configService.getOrThrow<string>('spotify.redirectUrl');
    this.mainUserSecret = this.configService.getOrThrow<string>('mainUserSecret');
    this.appToken = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    this.psGetUserBySpotifyUserId = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.userId, sql.placeholder('userId')))
      .limit(1)
      .prepare('get_user_by_spotify_user_id');
  }

  makeMeMainUserEndpoint(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: Record<string, any>,
    secret?: string,
  ) {
    if (
      !timingSafeEqual(
        Buffer.from(secret || 'dummysecret'),
        Buffer.from(this.mainUserSecret),
      )
    ) {
      throw new UnauthorizedException('Not main user');
    }

    session['isMainUser'] = 1;
    return { ok: true };
  }

  loginEndpoint(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: Record<string, any>,
    response: Response,
  ): void {
    if (!session['isMainUser']) {
      throw new UnauthorizedException('Not main user');
    }

    const state = v4();
    session['state'] = state;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUrl,
      response_type: 'code',
      scope: ['user-read-currently-playing'],
      state: state,
      show_dialog: String(true),
    });
    response.redirect(
      HttpStatus.TEMPORARY_REDIRECT,
      `${OAUTH_AUTHORIZE_URL}?${params.toString()}`,
    );
  }

  async loginRedirectEndpoint(
    code: string,
    state: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: Record<string, any>,
    response: Response,
  ): Promise<void> {
    if (
      !timingSafeEqual(
        Buffer.from(state),
        Buffer.from(session['state'] || 'dummystate'),
      )
    ) {
      throw new UnauthorizedException('State mismatch');
    }

    session['state'] = undefined;
    const strategy = await MelodiamAccessTokenStrategy.fromCode(code, this.appToken);
    const accessToken = await strategy.getAccessToken();
    const sdk = new SpotifyApi(strategy);
    const user = await sdk.currentUser.profile();
    const userRow = {
      displayName: user.display_name,
      accessToken: accessToken.access_token,
      refreshToken: accessToken.refresh_token,
      expiresAt: new Date(accessToken.expires!),
    };
    const [existingUser] = await this.psGetUserBySpotifyUserId.execute({
      userId: user.id,
    });
    if (!existingUser) {
      await this.db.insert(users).values({ ...userRow, userId: user.id });
    } else {
      await this.db
        .update(users)
        .set({ ...userRow, lastLoginAt: new Date() })
        .where(eq(users.id, existingUser.id));
    }

    response.redirect(HttpStatus.TEMPORARY_REDIRECT, '/');
  }
}
