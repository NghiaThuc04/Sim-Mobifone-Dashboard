import { Logger } from '@nestjs/common';
import { createApp } from './create-app';
import { ConfigurationError, readConfig } from './config';

async function bootstrap() {
  const config = readConfig();
  const port = config.PORT;
  const app = await createApp(true, config);
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  Logger.log(`Health API: http://127.0.0.1:${port}/api/v1/health`);
}

bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof ConfigurationError ? error.message : 'API startup failed; credentials are redacted.');
  process.exitCode = 1;
});
