import { HttpExceptionFilter } from '@algoan/nestjs-http-exception-filter';
import { NestFactory, NestApplication } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { WinstonModule, utilities } from 'nest-winston';
import { config } from 'node-config-ts';
import { format, transports } from 'winston';

import { AppModule } from './app.module';

const logger: Logger = new Logger(__filename);

/**
 * Bootstrap method
 */
const bootstrap = async (): Promise<void> => {
  const port: number = config.port;
  const defaultLevel: string = process.env.DEBUG_LEVEL ?? 'info';
  const nodeEnv: string | undefined = process.env.NODE_ENV;

  if (isEmpty(config.restHooksSecret) || isEmpty(config.customerIdPassword)) {
    throw new Error('Missing required secret configurations');
  }

  const app: NestApplication = await NestFactory.create(AppModule, {
    cors: true,
    logger: WinstonModule.createLogger({
      format:
        nodeEnv === 'production' ? format.json() : format.combine(format.timestamp(), utilities.format.nestLike()),
      level: defaultLevel,
      transports: [
        new transports.Console({
          level: defaultLevel,
          stderrLevels: ['error'],
          consoleWarnLevels: ['warning'],
          silent: nodeEnv === 'test',
        }),
      ],
    }),
  });

  /**
   * Attach global dependencies
   */
  app.useGlobalPipes(
    new ValidationPipe({
      /**
       * If set to true, validator will strip validated (returned)
       * object of any properties that do not use any validation decorators.
       */
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  logger.log(`Application is listening to port ${port}`);
};
bootstrap().catch((err: Error): void => {
  logger.error('An error occurred during bootstrapping', err.stack, { rawErrorMessage: err.message });
  process.exit(1);
});
