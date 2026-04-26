import pino, { type Logger } from 'pino';
import { env } from '../config/env.js';

export type LoggerBindings = Record<string, string | number | boolean | null>;

export const logger = pino({
  base: {
    service: env.APP_NAME,
    environment: env.NODE_ENV,
    pid: process.pid,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'token',
      '*.token',
      '*.password',
      '*.secret',
      '*.authorization',
      'authorization',
      'headers.authorization',
      'DISCORD_TOKEN',
      'process.env.DISCORD_TOKEN',
    ],
    censor: '[redacted]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(scope: string, bindings: LoggerBindings = {}): Logger {
  return logger.child({
    scope,
    ...bindings,
  });
}

export function flushLogger(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.flush((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
