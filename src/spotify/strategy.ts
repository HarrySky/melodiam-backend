import type { AccessToken, ICachable } from '@spotify/web-api-ts-sdk';

import { OAUTH_TOKEN_URL } from 'src/spotify/constants';

type UserRow = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export class MelodiamAccessTokenStrategy {
  private readonly appToken: string;
  private accessToken: AccessToken;

  constructor(appToken: string, accessToken: AccessToken) {
    this.appToken = appToken;
    this.accessToken = accessToken;
    if (!this.accessToken.expires) {
      this.accessToken.expires = Date.now() + accessToken.expires_in * 1000;
    }
  }

  static fromDatabaseUser(
    appToken: string,
    user: UserRow,
  ): MelodiamAccessTokenStrategy {
    const accessToken: AccessToken = {
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      token_type: 'Bearer',
      expires: user.expiresAt.getTime(),
      expires_in: Math.round((user.expiresAt.getTime() - new Date().getTime()) / 1000),
    };
    return new MelodiamAccessTokenStrategy(appToken, accessToken);
  }

  static async fromCode(
    code: string,
    appToken: string,
  ): Promise<MelodiamAccessTokenStrategy> {
    const params = new URLSearchParams({
      code: code,
      redirect_uri: process.env['SPOTIFY_REDIRECT_URL']!,
      grant_type: 'authorization_code',
    });
    const result = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${appToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const text = await result.text();
    if (!result.ok) {
      throw new Error(`Failed to get access token: ${result.statusText}, ${text}`);
    }

    const accessToken = JSON.parse(text) as AccessToken;
    return new MelodiamAccessTokenStrategy(appToken, accessToken);
  }

  async refreshNonPKCEAccessToken(
    refreshToken: string,
  ): Promise<ICachable & AccessToken> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const result = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.appToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const text = await result.text();
    if (!result.ok) {
      throw new Error(`Failed to refresh token: ${result.statusText}, ${text}`);
    }

    const accessToken = JSON.parse(text) as AccessToken;
    return {
      ...accessToken,
      // We re-use the same refresh_token in this flow
      refresh_token: refreshToken,
      expires: Date.now() + accessToken.expires_in * 1000,
    };
  }

  setConfiguration() {}

  async getOrCreateAccessToken() {
    if (this.accessToken.expires && this.accessToken.expires <= Date.now()) {
      const refreshed = await this.refreshNonPKCEAccessToken(
        this.accessToken.refresh_token,
      );
      this.accessToken = refreshed;
    }

    return this.accessToken;
  }

  async getAccessToken() {
    return this.accessToken;
  }

  removeAccessToken() {
    this.accessToken = {
      access_token: '',
      token_type: '',
      expires_in: 0,
      refresh_token: '',
      expires: 0,
    };
  }
}
