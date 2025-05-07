import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisStore } from 'connect-redis';
import basicAuth from 'express-basic-auth';
import session from 'express-session';
import { Logger } from 'nestjs-pino';
import { createClient } from 'redis';

import { AppModule } from 'src/app.module';

import { version } from '../package.json';

async function configureSessions(
  app: NestExpressApplication,
  configService: ConfigService,
) {
  const sessionSecret = configService.getOrThrow<string>('sessionSecret');
  const redisHost = configService.getOrThrow<string>('redis.host');
  const redisPort = configService.getOrThrow<number>('redis.port');
  const redisClient = createClient({ url: `redis://${redisHost}:${redisPort}` });
  await redisClient.connect();
  app.use(
    session({
      name: 'melodiam_session',
      rolling: true,
      store: new RedisStore({ client: redisClient, prefix: 'melodiam:' }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        sameSite: 'lax',
        // Session is valid for 14 days
        maxAge: 3600 * 24 * 14 * 1000,
      },
    }),
  );
}

function configureSwaggerDocs(
  app: NestExpressApplication,
  configService: ConfigService,
) {
  const globalPrefix = configService.getOrThrow<string>('globalPrefix');
  const docsUser = configService.getOrThrow<string>('docs.user');
  const docsPassword = configService.getOrThrow<string>('docs.pass');
  app.use(
    `${globalPrefix ? `/${globalPrefix}` : ''}/docs{*wildcard}`,
    basicAuth({
      challenge: true,
      realm: 'API Documentation',
      users: { [docsUser]: docsPassword },
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('Melodiam API')
    .setDescription(`Melodiam API docs`)
    .setVersion(version)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${globalPrefix ? `${globalPrefix}/` : ''}docs`, app, document, {
    swaggerOptions: { withCredentials: true },
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  const globalPrefix = configService.getOrThrow<string>('globalPrefix');
  app.setGlobalPrefix(globalPrefix);
  // Trust `X-Forwarded-*` headers up to certain hop
  const trustedProxyHops = configService.getOrThrow<number>('trustedProxyHops');
  app.set('trust proxy', trustedProxyHops);
  await configureSessions(app, configService);
  const isDebugEnabled = configService.getOrThrow<boolean>('debug');
  if (isDebugEnabled) {
    // eslint-disable-next-line no-console
    console.warn('Debug is enabled!');
  }

  // Enable data validation for all endpoints
  app.useGlobalPipes(
    new ValidationPipe({
      enableDebugMessages: isDebugEnabled,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      // Automatically remove properties that were not defined from the resulting DTO
      whitelist: true,
    }),
  );
  const docsEnabled = configService.getOrThrow<boolean>('docs.enabled');
  if (docsEnabled) {
    configureSwaggerDocs(app, configService);
  }

  const listenPort = configService.getOrThrow<number>('listenPort');
  // eslint-disable-next-line no-console
  console.log(`Listening on http://0.0.0.0:${listenPort}`);
  await app.listen(listenPort, '0.0.0.0');
}

void bootstrap();
