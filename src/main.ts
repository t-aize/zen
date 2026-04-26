import { startBot } from './bot.js';
import { createLogger, flushLogger } from './services/logger.js';

const logger = createLogger('bootstrap');

try {
  await startBot();
} catch (error) {
  logger.fatal({ err: error }, 'Failed to start Zen');
  await flushLogger();
  process.exitCode = 1;
}
