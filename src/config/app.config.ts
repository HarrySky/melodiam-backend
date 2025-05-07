export default () => ({
  debug: process.env['DEBUG']! === 'true',
  globalPrefix: process.env['GLOBAL_PREFIX']!,
  listenPort: parseInt(process.env['LISTEN_PORT']!, 10),
  trustedProxyHops: parseInt(process.env['TRUSTED_PROXY_HOPS']!, 10),
  sessionSecret: process.env['SESSION_SECRET']!,
  mainUserSecret: process.env['MAIN_USER_SECRET']!,
});
