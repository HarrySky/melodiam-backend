import { build, $ } from 'bun';

await $`rm -rf dist`;

const optionalRequirePackages = [
  '@nestjs/microservices',
  '@nestjs/websockets',
  '@fastify/static',
  'class-transformer/storage',
];

const result = await build({
  entrypoints: ['./src/main.ts'],
  outdir: './dist',
  target: 'bun',
  minify: {
    syntax: true,
    whitespace: true,
  },
  external: optionalRequirePackages.filter((pkg) => {
    try {
      require(pkg);
      return false;
    } catch (_) {
      return true;
    }
  }),
  splitting: true,
});

if (!result.success) {
  console.log(result.logs[0]);
  process.exit(1);
}

console.log('Built successfully!');
