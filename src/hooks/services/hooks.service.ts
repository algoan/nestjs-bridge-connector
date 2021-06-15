import {
  BanksUser,
  BanksUserAccount,
  BanksUserStatus,
  EventName,
  EventStatus,
  PostBanksUserAccountDTO,
  PostBanksUserTransactionDTO,
  ServiceAccount,
  Subscription,
  SubscriptionEvent,
} from '@algoan/rest';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as delay from 'delay';
import { isEmpty } from 'lodash';
import * as moment from 'moment';
import { config, Config } from 'node-config-ts';

import {
  AuthenticationResponse,
  BridgeAccount,
  BridgeTransaction,
  BridgeUserInformation,
} from '../../aggregator/interfaces/bridge.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import {
  mapBridgeAccount as mapBridgeAccountV2,
  mapBridgeTransactions as mapBridgeTransactionsV2,
} from '../../aggregator/services/bridge/bridge-v2.utils';
import { ClientConfig } from '../../aggregator/services/bridge/bridge.client';
import { mapBridgeAccount, mapBridgeTransactions } from '../../aggregator/services/bridge/bridge.utils';
import {
  Account as AnalysisAccount,
  AccountTransaction as AnalysisTransaction,
} from '../../algoan/dto/analysis.inputs';
import { AggregationDetailsAggregatorName, AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { AggregationDetails, Customer } from '../../algoan/dto/customer.objects';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { CONFIG } from '../../config/config.module';
import { AggregatorLinkRequiredDTO } from '../dto/aggregator-link-required.dto';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { BanksDetailsRequiredDTO } from '../dto/bank-details-required.dto';
import { BankreaderRequiredDTO } from '../dto/bankreader-required.dto';
import { EventDTO } from '../dto/event.dto';

/**
 * Hook service
 */
@Injectable()
export class HooksService {
  /**
   * Class logger
   */
  private readonly logger: Logger = new Logger(HooksService.name);

  constructor(
    @Inject(CONFIG) private readonly _config: Config,
    private readonly algoanHttpService: AlgoanHttpService,
    private readonly algoanCustomerService: AlgoanCustomerService,
    private readonly algoanAnalysisService: AlgoanAnalysisService,
    private readonly algoanService: AlgoanService,
    private readonly aggregator: AggregatorService,
  ) {}

  /**
   * Handle Algoan webhooks
   * @param event Event listened to
   * @param signature Signature headers, to check if the call is from Algoan
   */
  public async handleWebhook(event: EventDTO, signature: string): Promise<void> {
    const serviceAccount = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);

    this.logger.debug(serviceAccount, `Found a service account for subscription "${event.subscription.id}"`);

    if (serviceAccount === undefined) {
      throw new UnauthorizedException(`No service account found for subscription ${event.subscription.id}`);
    }

    // From the Bridge connector, need to find the bridge equivalent
    const subscription: Subscription | undefined = serviceAccount.subscriptions.find(
      (sub: Subscription) => sub.id === event.subscription.id,
    );

    if (subscription === undefined) {
      return;
    }

    if (!subscription.validateSignature(signature, (event.payload as unknown) as { [key: string]: string })) {
      throw new UnauthorizedException('Invalid X-Hub-Signature: you cannot call this API');
    }

    // Handle the event asynchronously
    void this.dispatchAndHandleWebhook(event, subscription, serviceAccount);

    return;
  }

  /**
   * Dispatch to the right webhook handler and handle
   *
   * Allow to asynchronously handle (with `void`) the webhook and firstly respond 204 to the server
   */
  private async dispatchAndHandleWebhook(
    event: EventDTO,
    subscription: Subscription,
    serviceAccount: ServiceAccount,
  ): Promise<void> {
    // ACKnowledge the subscription event
    const se: SubscriptionEvent = subscription.event(event.id);

    try {
      switch (event.subscription.eventName) {
        case EventName.AGGREGATOR_LINK_REQUIRED:
          await this.handleAggregatorLinkRequired(serviceAccount, event.payload as AggregatorLinkRequiredDTO);
          break;

        case EventName.BANK_DETAILS_REQUIRED:
          await this.handleBankDetailsRequiredEvent(serviceAccount, event.payload as BanksDetailsRequiredDTO);
          break;

        case EventName.BANKREADER_LINK_REQUIRED:
          await this.handleBankreaderLinkRequiredEvent(serviceAccount, event.payload as BankreaderLinkRequiredDTO);
          break;

        // case EventName.BANKREADER_CONFIGURATION_REQUIRED:
        //   break;

        case EventName.BANKREADER_REQUIRED:
          await this.handleBankReaderRequiredEvent(serviceAccount, event.payload as BankreaderRequiredDTO);
          break;

        // The default case should never be reached, as the eventName is already checked in the DTO
        default:
          void se.update({ status: EventStatus.FAILED });

          return;
      }
    } catch (err) {
      void se.update({ status: EventStatus.ERROR });

      throw err;
    }

    void se.update({ status: EventStatus.PROCESSED });
  }

  /**
   * Handle the "aggregator_link_required" event
   * Looks for a callback URL and generates a new redirect URL
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the Banks User id
   */
  public async handleAggregatorLinkRequired(
    serviceAccount: ServiceAccount,
    payload: AggregatorLinkRequiredDTO,
  ): Promise<void> {
    // Authenticate to algoan
    this.algoanHttpService.authenticate(serviceAccount.clientId, serviceAccount.clientSecret);

    // Get user information and client config
    const customer: Customer = await this.algoanCustomerService.getCustomerById(payload.customerId);
    this.logger.debug({ customer, serviceAccount }, `Found Customer with id ${customer.id}`);

    const aggregationDetails: AggregationDetails = {
      aggregatorName: AggregationDetailsAggregatorName.BRIDGE,
    };
    switch (customer.aggregationDetails?.mode) {
      case AggregationDetailsMode.REDIRECT:
        // Generates a redirect URL
        aggregationDetails.redirectUrl = await this.aggregator.generateRedirectUrl(
          customer.id,
          customer.aggregationDetails?.callbackUrl,
          customer.personalDetails?.contact?.email,
          serviceAccount.config as ClientConfig,
        );
        break;

      default:
        throw new Error(`Invalid bank connection mode ${customer.aggregationDetails?.mode}`);
    }

    // Update user with redirect link information and userId if provided
    await this.algoanCustomerService.updateCustomer(payload.customerId, {
      aggregationDetails,
    });

    this.logger.debug(`Updated Customer ${payload.customerId}`);

    return;
  }

  /**
   * Handle the "bankreader_link_required" event
   * Looks for a callback URL and generates a new redirect URL
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the Banks User id
   */
  public async handleBankreaderLinkRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BankreaderLinkRequiredDTO,
  ): Promise<void> {
    let email: string | undefined;

    /**
     * 1. GET the banks user to retrieve the callback URL and the application to get the email
     */
    const banksUser: BanksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    this.logger.debug({ banksUser, serviceAccount }, `Found BanksUser with id ${banksUser.id}`);

    /**
     * 1-1. If the applicationId is defined, try to get an email
     * If the request fails, do not block the process
     */
    try {
      const application = await serviceAccount.getApplicationById(payload.applicationId);
      email = application.applicant?.contact?.email;
    } catch (err) {
      this.logger.warn(payload, `Application cannot be retrieved`);
    }

    /**
     * 2. Generates a redirect URL
     */
    const redirectUrl: string = await this.aggregator.generateRedirectUrl(
      banksUser.id,
      banksUser.callbackUrl,
      email,
      serviceAccount.config as ClientConfig,
    );

    /**
     * 3. Update the Banks-User, sending to Algoan the generated URL
     */
    await banksUser.update({
      redirectUrl,
    });

    this.logger.debug(`Added redirect url ${banksUser.redirectUrl} to banksUser ${banksUser.id}`);

    return;
  }

  /**
   * Handle the "bankreader_required" subscription
   * It triggers the banks accounts and transactions synchronization
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the Banks User id
   */
  public async handleBankReaderRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BankreaderRequiredDTO,
  ): Promise<void> {
    const banksUser: BanksUser = await serviceAccount.getBanksUserById(payload.banksUserId);

    /**
     * 0. Notify Algoan that the synchronization is starting
     */
    await banksUser.update({
      status: BanksUserStatus.SYNCHRONIZING,
    });

    /**
     * 1. Retrieves an access token from Bridge to access to the user accounts
     */
    const authenticationResponse: AuthenticationResponse = await this.aggregator.getAccessToken(
      banksUser.id,
      serviceAccount.config as ClientConfig,
    );
    const accessToken: string = authenticationResponse.access_token;
    const bridgeUserId: string = authenticationResponse.user.uuid;

    /**
     * 2. Retrieves Bridge banks accounts and send them to Algoan
     */
    const accounts: BridgeAccount[] = await this.aggregator.getAccounts(
      accessToken,
      serviceAccount.config as ClientConfig,
    );
    this.logger.debug({
      message: `Bridge accounts retrieved for Banks User "${banksUser.id}"`,
      accounts,
    });

    /**
     * 2.b. Get personal information
     */
    let userInfo: BridgeUserInformation[] = [];
    try {
      userInfo = await this.aggregator.getUserPersonalInformation(accessToken, serviceAccount.config as ClientConfig);
    } catch (err) {
      this.logger.warn({ message: `Unable to get user personal information`, error: err });
    }

    const algoanAccounts: PostBanksUserAccountDTO[] = await mapBridgeAccount(
      accounts,
      userInfo,
      accessToken,
      this.aggregator,
      serviceAccount.config as ClientConfig,
    );
    const createdAccounts: BanksUserAccount[] = await banksUser.createAccounts(algoanAccounts);
    this.logger.debug({
      message: `Algoan accounts created for Banks User "${banksUser.id}"`,
      accounts: createdAccounts,
    });

    /**
     * 3. Notify Algoan that the accounts have been synchronized
     */
    await banksUser.update({
      status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
    });

    /**
     * 4. Retrieves Bridge transactions and send them to Algoan
     */
    const timeout = moment().add(config.bridge.synchronizationTimeout, 'seconds');
    let lastUpdatedAt: string | undefined;
    let firstFetchedDate: string;
    let transactions: BridgeTransaction[] = [];
    let sortedTransactions: BridgeTransaction[] = [];
    /* eslint-disable no-magic-numbers */
    const nbOfMonths: number = (serviceAccount.config as ClientConfig).nbOfMonths ?? 3;

    do {
      transactions = await this.aggregator.getTransactions(
        accessToken,
        lastUpdatedAt,
        serviceAccount.config as ClientConfig,
      );

      for (const account of createdAccounts) {
        const algoanTransactions: PostBanksUserTransactionDTO[] = await mapBridgeTransactions(
          transactions.filter((transaction: BridgeTransaction) => transaction.account.id === Number(account.reference)),
          accessToken,
          this.aggregator,
          serviceAccount.config as ClientConfig,
        );
        if (!isEmpty(algoanTransactions)) {
          await banksUser.createTransactions(account.id, algoanTransactions);
        }
      }

      /**
       * Sort the transactions by updated_at
       */
      sortedTransactions = transactions?.sort((tr1: BridgeTransaction, tr2: BridgeTransaction) =>
        /* eslint-disable no-magic-numbers */
        moment(tr1.updated_at).isBefore(moment(tr2.updated_at)) ? 1 : -1,
      );

      lastUpdatedAt = sortedTransactions[0]?.updated_at ?? lastUpdatedAt;

      /**
       * Sort the transactions by date
       */
      sortedTransactions = transactions?.sort((tr1: BridgeTransaction, tr2: BridgeTransaction) =>
        /* eslint-disable no-magic-numbers */
        moment(tr1.date).isBefore(moment(tr2.date)) ? -1 : 1,
      );

      firstFetchedDate = sortedTransactions[0]?.date;
      // Wait between each call
      await delay(config.bridge.synchronizationWaitingTime);
    } while (moment().diff(moment(firstFetchedDate), 'months') <= nbOfMonths && moment().isBefore(timeout));

    /**
     * 5. Notify Algoan that the process is finished
     */
    await banksUser.update({
      status: BanksUserStatus.FINISHED,
    });

    /**
     * 6. Delete the user from Bridge
     */
    await this.aggregator.deleteUser(
      {
        bridgeUserId,
        id: banksUser.id,
        accessToken,
      },
      serviceAccount.config as ClientConfig,
    );

    return;
  }

  /**
   * Handle the "bank_details_required" subscription
   * It triggers the banks accounts and transactions synchronization
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the Banks User id
   */
  public async handleBankDetailsRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BanksDetailsRequiredDTO,
  ): Promise<void> {
    // Authenticate to algoan
    this.algoanHttpService.authenticate(serviceAccount.clientId, serviceAccount.clientSecret);

    // Get customer information
    const customer: Customer = await this.algoanCustomerService.getCustomerById(payload.customerId);
    this.logger.debug({ customer, serviceAccount }, `Found Customer with id ${customer.id}`);

    // Retrieves an access token from Bridge to access to the user accounts
    const authenticationResponse: AuthenticationResponse = await this.aggregator.getAccessToken(
      customer.id,
      serviceAccount.config as ClientConfig,
    );
    const accessToken: string = authenticationResponse.access_token;
    const bridgeUserId: string = authenticationResponse.user.uuid;

    // Retrieves Bridge banks accounts
    const accounts: BridgeAccount[] = await this.aggregator.getAccounts(
      accessToken,
      serviceAccount.config as ClientConfig,
    );
    this.logger.debug({
      message: `Bridge accounts retrieved for Customer "${customer.id}"`,
      accounts,
    });

    // Get personal information
    let userInfo: BridgeUserInformation[] = [];
    try {
      userInfo = await this.aggregator.getUserPersonalInformation(accessToken, serviceAccount.config as ClientConfig);
    } catch (err) {
      this.logger.warn({ message: `Unable to get user personal information`, error: err });
    }

    const algoanAccounts: AnalysisAccount[] = await mapBridgeAccountV2(
      accounts,
      userInfo,
      accessToken,
      this.aggregator,
      serviceAccount.config as ClientConfig,
    );

    // Retrieves Bridge transactions
    // eslint-disable-next-line no-underscore-dangle
    const timeout = moment().add(this._config.bridge.synchronizationTimeout, 'seconds');
    let lastUpdatedAt: string | undefined;
    let transactions: BridgeTransaction[] = [];
    /* eslint-disable no-magic-numbers */
    const nbOfMonths: number = (serviceAccount.config as ClientConfig).nbOfMonths ?? 3;

    do {
      const fetchedTransactions: BridgeTransaction[] = await this.aggregator.getTransactions(
        accessToken,
        lastUpdatedAt,
        serviceAccount.config as ClientConfig,
      );

      transactions = transactions.concat(fetchedTransactions);
      // Sort transactions by date
      transactions = transactions.sort((tr1: BridgeTransaction, tr2: BridgeTransaction) =>
        /* eslint-disable no-magic-numbers */
        moment(tr1.date).isBefore(moment(tr2.date)) ? -1 : 1,
      );
    } while (
      moment().diff(moment(transactions[0]?.date), 'months') <= nbOfMonths &&
      moment().isBefore(timeout) &&
      // eslint-disable-next-line no-underscore-dangle
      (await delay(this._config.bridge.synchronizationWaitingTime, { value: true }))
    );

    for (const account of algoanAccounts) {
      const algoanTransactions: AnalysisTransaction[] = await mapBridgeTransactionsV2(
        transactions.filter(
          (transaction: BridgeTransaction) => transaction.account.id === Number(account.aggregator?.id),
        ),
        accessToken,
        this.aggregator,
        serviceAccount.config as ClientConfig,
      );
      if (!isEmpty(algoanTransactions)) {
        account.transactions = algoanTransactions;
      }
    }

    // Update the analysis
    await this.algoanAnalysisService.updateAnalysis(customer.id, payload.analysisId, {
      accounts: algoanAccounts,
    });

    // Delete the user from Bridge
    const user = {
      bridgeUserId,
      id: customer.id,
      accessToken,
    };
    await this.aggregator.deleteUser(user, serviceAccount.config as ClientConfig);

    return;
  }
}
