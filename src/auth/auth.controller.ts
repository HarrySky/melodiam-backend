import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  Session,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

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
    @Res() response: Response,
  ): void {
    this.authService.loginEndpoint(session, response);
  }

  @Get('login_redirect')
  async loginRedirect(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Session() session: Record<string, any>,
    @Res() response: Response,
    @Query('state') state?: string,
    @Query('code') code?: string,
    @Query('error') error?: string,
  ): Promise<void> {
    if (error) {
      throw new BadGatewayException(`Spotify Web API error: ${error}`);
    }

    if (!state || !code) {
      throw new BadRequestException('Missing state and/or code parameters');
    }

    await this.authService.loginRedirectEndpoint(code, state, session, response);
  }
}
