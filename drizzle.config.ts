import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env['DATABASE_HOST']!,
    port: parseInt(process.env['DATABASE_PORT'] || '5432', 10),
    user: process.env['DATABASE_USER'] || 'melodiam',
    password: process.env['DATABASE_PASS']!,
    database: process.env['DATABASE_NAME'] || 'melodiam',
    ssl: false,
  },
});