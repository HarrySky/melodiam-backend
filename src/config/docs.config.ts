import { registerAs } from '@nestjs/config';

export default registerAs('docs', () => ({
  enabled: process.env['DOCS_ENABLED']! === 'true',
  user: process.env['DOCS_BASIC_USER']!,
  pass: process.env['DOCS_BASIC_PASS']!,
}));
