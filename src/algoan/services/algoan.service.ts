import { Algoan, EventName, PostSubscriptionDTO } from '@algoan/rest';
import { Injectable, OnModuleInit, InternalServerErrorException, Inject } from '@nestjs/common';
import { utilities } from 'nest-winston';
import { Config } from 'node-config-ts';
import { format, transports } from 'winston';
import { ServiceAccountUpdatedDTO } from '../../hooks/dto/service-account-updated.dto';
import { ServiceAccountCreatedDTO } from '../../hooks/dto/service-account-created.dto';
import { CONFIG } from '../../config/config.module';
import { AlgoanServiceAcountService } from './algoan-service-account.service';

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

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly serviceAccountService: AlgoanServiceAcountService,
  ) {}

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
      baseUrl: this.config.algoan.baseUrl,
      clientId: this.config.algoan.clientId,
      clientSecret: this.config.algoan.clientSecret,
      version: this.config.algoan.version,
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

    if (this.config.eventList?.length <= 0) {
      throw new InternalServerErrorException('No event list given');
    }

    await this.initRestHooks(this.config.targetUrl, this.config.eventList as EventName[], this.config.restHooksSecret);
  }

  /**
   * Init resthooks in V2
   */
  public async initRestHooks(target: string, events: EventName[] = [], secret?: string): Promise<void> {
    this.algoanClient.serviceAccounts = await this.serviceAccountService.findAll();

    if (this.algoanClient.serviceAccounts.length === 0) {
      return;
    }
    const subscriptionDTO: PostSubscriptionDTO[] = this.fromEventToSubscriptionDTO(target, events, secret);

    for (const serviceAccount of this.algoanClient.serviceAccounts) {
      await serviceAccount.getOrCreateSubscriptions(subscriptionDTO, events);
    }
  }

  /**
   * Transform a list of events to a Subscription request body
   * @param target Base URL
   * @param eventName List of events
   * @param secret Secret
   */
  // eslint-disable-next-line
  private readonly fromEventToSubscriptionDTO = (
    target: string,
    events: EventName[],
    secret?: string,
  ): PostSubscriptionDTO[] =>
    events.map(
      (event: EventName): PostSubscriptionDTO => ({
        target,
        secret,
        eventName: event,
      }),
    );

  /**
   * Store the new service account in-memory and create subscriptions
   * @param serviceAccount
   * @param subscriptionDto
   */
  public async saveServiceAccount(payload: ServiceAccountCreatedDTO): Promise<void> {
    const addedServiceAccount = await this.serviceAccountService.findById(payload.serviceAccountId);

    const eventNames: EventName[] = this.config.eventList as EventName[];

    if (addedServiceAccount !== undefined) {
      const subscriptionDTO: PostSubscriptionDTO[] = this.fromEventToSubscriptionDTO(
        this.config.targetUrl,
        eventNames,
        this.config.restHooksSecret,
      );
      this.algoanClient.serviceAccounts.push(addedServiceAccount);
      await addedServiceAccount.getOrCreateSubscriptions(subscriptionDTO, eventNames);
    }
  }

  /**
   * Update the service account config
   * @param payload
   */
  public async updateServiceAccount(payload: ServiceAccountUpdatedDTO): Promise<void> {
    const updatedServiceAccount = await this.serviceAccountService.findById(payload.serviceAccountId);

    if (updatedServiceAccount) {
      const oldServiceAccountIdx = this.algoanClient.serviceAccounts.findIndex(
        (serviceAccount) => serviceAccount.clientId === updatedServiceAccount?.clientId,
      );
      // eslint-disable-next-line
      if (oldServiceAccountIdx > -1) {
        this.algoanClient.serviceAccounts[oldServiceAccountIdx].config = updatedServiceAccount.config;
      }
    }
  }
}
