import { Algoan, EventName } from '@algoan/rest';
import { Injectable, OnModuleInit, InternalServerErrorException, Logger } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { config } from 'node-config-ts';

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
    /**
     * Retrieve service accounts and get/create subscriptions
     */
    this.algoanClient = new Algoan({
      baseUrl: config.algoan.baseUrl,
      clientId: config.algoan.clientId,
      clientSecret: config.algoan.clientSecret,
      debug: config.algoan.debug,
    });

    if (isEmpty(config.eventList)) {
      throw new InternalServerErrorException('No event list given');
    }

    await this.algoanClient.initRestHooks(config.targetUrl, config.eventList as EventName[], config.restHooksSecret);
  }
}
