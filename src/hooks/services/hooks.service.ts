import { EventName, EventStatus, ServiceAccount, Subscription, SubscriptionEvent } from '@algoan/rest';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as delay from 'delay';
import { isEmpty } from 'lodash';
import * as moment from 'moment';
import { Config } from 'node-config-ts';
import {
  AccountInformation,
  AuthenticationResponse,
  BridgeAccount,
  BridgeRefreshStatus,
  BridgeTransaction,
} from '../../aggregator/interfaces/bridge.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import {
  mapBridgeAccount as mapBridgeAccountV2,
  mapBridgeTransactions as mapBridgeTransactionsV2,
} from '../../aggregator/services/bridge/bridge-v2.utils';
import { ClientConfig } from '../../aggregator/services/bridge/bridge.client';
import { AccountType, AnalysisStatus, ErrorCodes } from '../../algoan/dto/analysis.enum';
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
import { BanksDetailsRequiredDTO } from '../dto/bank-details-required.dto';
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
    @Inject(CONFIG) private readonly config: Config,
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
    const aggregationStartDate: Date = new Date();
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

    if (!subscription.validateSignature(signature, event.payload as unknown as { [key: string]: string })) {
      throw new UnauthorizedException('Invalid X-Hub-Signature: you cannot call this API');
    }

    // Handle the event asynchronously
    void this.dispatchAndHandleWebhook(event, subscription, serviceAccount, aggregationStartDate);

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
    aggregationStartDate: Date,
  ): Promise<void> {
    // ACKnowledge the subscription event
    const se: SubscriptionEvent = subscription.event(event.id);

    try {
      switch (event.subscription.eventName) {
        case EventName.AGGREGATOR_LINK_REQUIRED:
          await this.handleAggregatorLinkRequired(serviceAccount, event.payload as AggregatorLinkRequiredDTO);
          break;

        case EventName.BANK_DETAILS_REQUIRED:
          await this.handleBankDetailsRequiredEvent(
            serviceAccount,
            event.payload as BanksDetailsRequiredDTO,
            aggregationStartDate,
          );
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
   * @param payload Payload sent, containing the customer id
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
          customer.personalDetails?.contact?.email,
          serviceAccount.config as ClientConfig,
          customer.customIdentifier,
        );
        break;

      case AggregationDetailsMode.IFRAME:
        aggregationDetails.iframeUrl = await this.aggregator.generateRedirectUrl(
          customer.id,
          customer.personalDetails?.contact?.email,
          serviceAccount.config as ClientConfig,
          customer.customIdentifier,
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
   * Handle the "bank_details_required" subscription
   * It triggers the banks accounts and transactions synchronization
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the customer id
   */
  /* eslint-disable-next-line */
  public async handleBankDetailsRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BanksDetailsRequiredDTO,
    aggregationStartDate: Date,
  ): Promise<void> {
    try {
      const saConfig: ClientConfig = serviceAccount.config as ClientConfig;

      // Authenticate to algoan
      this.algoanHttpService.authenticate(serviceAccount.clientId, serviceAccount.clientSecret);

      // Get customer information
      const customer: Customer = await this.algoanCustomerService.getCustomerById(payload.customerId);
      this.logger.debug({ customer, serviceAccount }, `Found Customer with id ${customer.id}`);

      // Retrieves an access token from Bridge to access to the user accounts
      const authenticationResponse: AuthenticationResponse = await this.aggregator.getAccessToken(
        customer.id,
        saConfig,
      );
      const accessToken: string = authenticationResponse.access_token;
      const bridgeUserId: string = authenticationResponse.user.uuid;

      if (customer.aggregationDetails.userId !== undefined) {
        // Init refresh
        await this.aggregator.refresh(customer.aggregationDetails.userId, accessToken, saConfig);

        // Wait until refresh is finished
        let refresh: BridgeRefreshStatus;
        const timeoutRefresh: moment.Moment = moment().add(this.config.bridge.synchronizationTimeout);

        do {
          refresh = await this.aggregator.getRefreshStatus(customer.aggregationDetails.userId, accessToken, saConfig);
        } while (
          refresh?.status !== 'finished' &&
          moment().isBefore(timeoutRefresh) &&
          (await delay(this.config.bridge.synchronizationWaitingTime, { value: true }))
        );
      }

      // Retrieves Bridge banks accounts
      const accounts: BridgeAccount[] = await this.aggregator.getAccounts(accessToken, saConfig);
      this.logger.debug({
        message: `Bridge accounts retrieved for Customer "${customer.id}"`,
        accounts,
      });

      // Get account information
      let accountInfo: AccountInformation[] = [];
      try {
        accountInfo = await this.aggregator.getAccountInformation(accessToken, saConfig);
      } catch (err) {
        this.logger.warn({ message: `Unable to get the account information`, error: err });
      }

      const algoanAccounts: AnalysisAccount[] = await mapBridgeAccountV2(
        accounts,
        accountInfo,
        accessToken,
        this.aggregator,
        saConfig,
      );

      // Retrieves Bridge transactions
      const timeout = moment().add(this.config.bridge.synchronizationTimeout, 'seconds');
      let lastUpdatedAt: string | undefined;
      let transactions: BridgeTransaction[] = [];
      /* eslint-disable no-magic-numbers */
      const nbOfMonths: number = saConfig.nbOfMonths ?? 3;

      do {
        const fetchedTransactions: BridgeTransaction[] = await this.aggregator.getTransactions(
          accessToken,
          lastUpdatedAt,
          saConfig,
        );

        if (fetchedTransactions.length === 0) {
          break;
        }

        transactions = transactions.concat(fetchedTransactions);
        lastUpdatedAt = fetchedTransactions[0]?.updated_at ?? lastUpdatedAt;
        for (const transaction of fetchedTransactions) {
          if (moment(transaction.updated_at).isAfter(lastUpdatedAt)) {
            lastUpdatedAt = transaction.updated_at;
          }
        }

        // Sort transactions by date
        transactions = transactions.sort((tr1: BridgeTransaction, tr2: BridgeTransaction) =>
          /* eslint-disable no-magic-numbers */
          moment(tr1.date).isBefore(moment(tr2.date)) ? -1 : 1,
        );
      } while (
        moment().diff(moment(transactions[0]?.date), 'months') <= nbOfMonths &&
        moment().isBefore(timeout) &&
        (await delay(this.config.bridge.synchronizationWaitingTime, { value: true }))
      );

      for (const account of algoanAccounts) {
        const algoanTransactions: AnalysisTransaction[] = await mapBridgeTransactionsV2(
          transactions.filter(
            (transaction: BridgeTransaction) => transaction.account_id === Number(account.aggregator?.id),
          ),
          accessToken,
          this.aggregator,
          account.type,
          saConfig,
        );
        if (!isEmpty(algoanTransactions)) {
          account.transactions = algoanTransactions;
        }
      }

      const aggregationDuration: number = new Date().getTime() - aggregationStartDate.getTime();

      this.logger.log({
        message: `Account aggregation completed in ${aggregationDuration} milliseconds for Customer ${payload.customerId} and Analysis ${payload.analysisId}.`,
        aggregator: 'BRIDGE',
        duration: aggregationDuration,
      });

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

      if (
        this.config.forceBridgeUsersDeletion ||
        saConfig.deleteBridgeUsers === undefined ||
        saConfig.deleteBridgeUsers
      ) {
        await this.aggregator.deleteUser(user, saConfig);
      }

      return;
    } catch (err: unknown) {
      const host = (err as { request?: { host: string } }).request?.host;
      let message = 'An error occurred on the aggregator connector';
      if (host !== undefined) {
        message = host.includes('algoan')
          ? 'An error occurred while calling Algoan APIs'
          : 'An error occurred while fetching data from the aggregator';
      }

      this.logger.debug({
        message: `An error occurred while fetching data from the aggregator for analysis id ${payload.analysisId} and customer id ${payload.customerId}`,
        error: err,
      });

      // Update the analysis error
      await this.algoanAnalysisService.updateAnalysis(payload.customerId, payload.analysisId, {
        status: AnalysisStatus.ERROR,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message,
        },
      });

      throw err;
    }
  }
}
