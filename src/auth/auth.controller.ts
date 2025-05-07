import type { HttpRedirectResponse } from '@nestjs/common';
import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Query,
  Session,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from 'src/auth/auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('make_me_main_user')
  makeMeMainUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Session() session: Record<string, any>,
    @Query('secret') secret?: string,
  ) {
    return this.authService.makeMeMainUserEndpoint(session, secret);
  }

  @Get('login')
  login(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Session() session: Record<string, any>,
  ): HttpRedirectResponse {
    return this.authService.loginEndpoint(session);
  }

  @Get('login_redirect')
  async loginRedirect(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Session() session: Record<string, any>,
    @Query('state') state?: string,
    @Query('code') code?: string,
    @Query('error') error?: string,
  ): Promise<HttpRedirectResponse> {
    if (error) {
      throw new BadGatewayException(`Spotify Web API error: ${error}`);
    }

    if (!state || !code) {
      throw new BadRequestException('Missing state and/or code parameters');
    }

    return await this.authService.loginRedirectEndpoint(code, state, session);
  }
}
