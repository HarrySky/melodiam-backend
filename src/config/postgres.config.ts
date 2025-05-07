import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env['DATABASE_HOST']!,
  port: parseInt(process.env['DATABASE_PORT']!, 10),
  user: process.env['DATABASE_USER']!,
  pass: process.env['DATABASE_PASS']!,
  name: process.env['DATABASE_NAME']!,
}));
