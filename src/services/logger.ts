import pino, { type Logger, type LoggerOptions } from 'pino';
import { env } from '../config/env.js';

const loggerOptions: LoggerOptions = {
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
};

if (env.LOG_PRETTY) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: env.NODE_ENV !== 'production',
      ignore: 'pid,hostname',
      levelFirst: true,
      singleLine: false,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
    },
  };
}

export const logger = pino(loggerOptions);

export function createLogger(scope: string, bindings: LoggerOptions = {}): Logger {
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
