import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL } from 'bun';
import { drizzle, BunSQLDatabase } from 'drizzle-orm/bun-sql';

import * as schema from 'src/db/schema';

export const DrizzleAsyncProvider = 'DrizzleAsyncProvider';

export const drizzleProvider = {
  provide: DrizzleAsyncProvider,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const client = new SQL({
      host: configService.getOrThrow<string>('database.host'),
      port: configService.getOrThrow<number>('database.port'),
      username: configService.getOrThrow<string>('database.user'),
      password: configService.getOrThrow<string>('database.pass'),
      database: configService.getOrThrow<string>('database.name'),
      ssl: false,
      max: 10,
      idleTimeout: 30,
      maxLifetime: 0,
      connectionTimeout: 5,
    });
    return drizzle({ client, schema }) as BunSQLDatabase<typeof schema>;
  },
};

@Module({
  providers: [drizzleProvider],
  exports: [DrizzleAsyncProvider],
})
export class DrizzleModule {}
