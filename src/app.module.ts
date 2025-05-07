import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import Joi from 'joi';
import { LoggerModule } from 'nestjs-pino';
import { v4 } from 'uuid';

import { AuthModule } from 'src/auth/auth.module';
import appConfig from 'src/config/app.config';
import docsConfig from 'src/config/docs.config';
import postgresConfig from 'src/config/postgres.config';
import redisConfig from 'src/config/redis.config';
import spotifyConfig from 'src/config/spotify.config';
import { SpotifyModule } from 'src/spotify/spotify.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, docsConfig, postgresConfig, redisConfig, spotifyConfig],
      validationSchema: Joi.object({
        DEBUG: Joi.string().empty('').allow('true', 'false').default('false'),
        GLOBAL_PREFIX: Joi.string().empty('').default(''),
        LISTEN_PORT: Joi.number().port().empty('').default(3000),
        TRUSTED_PROXY_HOPS: Joi.number().integer().positive().empty('').default(0),
        SESSION_SECRET: Joi.string().min(32).required(),
        MAIN_USER_SECRET: Joi.string().min(32).required(),
        DOCS_ENABLED: Joi.string().empty('').allow('true', 'false').default('false'),
        DOCS_BASIC_USER: Joi.string().empty('').default('melodiam'),
        DOCS_BASIC_PASS: Joi.string().when('DOCS_ENABLED', {
          is: Joi.string().equal('true'),
          then: Joi.string().required(),
          otherwise: Joi.string().empty('').default(''),
        }),
        DATABASE_HOST: Joi.string().hostname().required(),
        DATABASE_PORT: Joi.number().port().empty('').default(5432),
        DATABASE_USER: Joi.string().empty('').default('melodiam'),
        DATABASE_PASS: Joi.string().required(),
        DATABASE_NAME: Joi.string().empty('').default('melodiam'),
        REDIS_HOST: Joi.string().hostname().required(),
        REDIS_PORT: Joi.number().port().empty('').default(6379),
        SPOTIFY_CLIENT_ID: Joi.string().required(),
        SPOTIFY_CLIENT_SECRET: Joi.string().required(),
        SPOTIFY_REDIRECT_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .required(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.getOrThrow<boolean>('debug') ? 'debug' : 'info',
          genReqId: (req) => req.headers['x-request-id'] || v4(),
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    // App modules:
    AuthModule,
    SpotifyModule,
  ],
})
export class AppModule {}
