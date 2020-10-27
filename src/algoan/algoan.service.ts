import { Algoan, EventName } from '@algoan/rest';
import { Injectable, OnModuleInit, InternalServerErrorException, Logger } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { utilities } from 'nest-winston';
import { config } from 'node-config-ts';
import { format, transports } from 'winston';

/**
 * Algoan service
 * Stores all methods related to Algoan
 */
@Injectable()
export class AlgoanService implements OnModuleInit {
  /**
   * Algoan client
   */
  public algoanClient!: Algoan;

  /**
   * Logger instance
   */
  private readonly logger: Logger = new Logger(AlgoanService.name);

  /**
   * Fetch services and creates subscription
   */
  public async onModuleInit(): Promise<void> {
    const defaultLevel: string = process.env.DEBUG_LEVEL ?? 'info';
    const nodeEnv: string | undefined = process.env.NODE_ENV;

    /**
     * Retrieve service accounts and get/create subscriptions
     */
    this.algoanClient = new Algoan({
      baseUrl: config.algoan.baseUrl,
      clientId: config.algoan.clientId,
      clientSecret: config.algoan.clientSecret,
      debug: config.algoan.debug,
      loggerOptions: {
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
      },
    });

    if (isEmpty(config.eventList)) {
      throw new InternalServerErrorException('No event list given');
    }

    await this.algoanClient.initRestHooks(config.targetUrl, config.eventList as EventName[], config.restHooksSecret);
  }
}
