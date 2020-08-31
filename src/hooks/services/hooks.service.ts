import {
  BanksUserAccount,
  ServiceAccount,
  Subscription,
  EventName,
  BanksUser,
  PostBanksUserAccountDTO,
  PostBanksUserTransactionDTO,
  BanksUserStatus,
  // BanksUserStatus,
  // PostBanksUserTransactionDTO,
  // PostBanksUserAccountDTO,
} from '@algoan/rest';
import { UnauthorizedException, Injectable, Logger } from '@nestjs/common';

import { AlgoanService } from '../../algoan/algoan.service';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { BridgeAccount, BridgeTransaction } from '../../aggregator/interfaces/bridge.interface';
import { mapBridgeAccount, mapBridgeTransactions } from '../../aggregator/services/bridge/bridge.utils';
import { EventDTO } from '../dto/event.dto';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { BankreaderRequiredDTO } from '../dto/bankreader-required.dto';
import { ClientConfig } from '../../aggregator/services/bridge/bridge.client';
/**
 * Hook service
 */
@Injectable()
export class HooksService {
  /**
   * Class logger
   */
  private readonly logger: Logger = new Logger(HooksService.name);

  constructor(private readonly algoanService: AlgoanService, private readonly aggregator: AggregatorService) {}

  /**
   * Handle Algoan webhooks
   * @param event Event listened to
   * @param signature Signature headers, to check if the call is from Algoan
   */
  public async handleWebhook(event: EventDTO, signature: string): Promise<void> {
    const serviceAccount = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);

    if (serviceAccount === undefined) {
      throw new UnauthorizedException(`No service account found for subscription ${event.subscription.id}`);
    }

    // From the budget insight connector, need to find the bridge equivalent
    const subscription: Subscription = serviceAccount.subscriptions.find(
      (sub: Subscription) => sub.id === event.subscription.id,
    );

    if (!subscription.validateSignature(signature, (event.payload as unknown) as { [key: string]: string })) {
      throw new UnauthorizedException('Invalid X-Hub-Signature: you cannot call this API');
    }

    switch (event.subscription.eventName) {
      case EventName.BANKREADER_LINK_REQUIRED:
        // @ts-ignore
        await this.handleBankreaderLinkRequiredEvent(serviceAccount, event.payload as BankreaderLinkRequiredDTO);
        break;

      // case EventName.BANKREADER_CONFIGURATION_REQUIRED:
      //   break;

      case EventName.BANKREADER_REQUIRED:
        await this.handleBankReaderRequiredEvent(serviceAccount, event.payload as BankreaderRequiredDTO);
        break;

      // The default case should never be reached, as the eventName is already checked in the DTO
      default:
        return;
    }

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
    /**
     * 1. GET the banks user to retrieve the callback URL
     */
    const banksUser: BanksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    this.logger.debug(`Found BanksUser with id ${banksUser.id}`);

    /**
     * 2. Generates a redirect URL
     */
    const redirectUrl: string = await this.aggregator.generateRedirectUrl(
      banksUser,
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
    /**
     * 1. Retrieves an access token from Bridge to access to the user accounts
     */
    const banksUser: BanksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    const accessToken = await this.aggregator.getAccessToken(banksUser, serviceAccount.config as ClientConfig);

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
    const algoanAccounts: PostBanksUserAccountDTO[] = await mapBridgeAccount(
      accounts,
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
     * 3. For each synchronized accounts, get transactions
     */
    for (const account of createdAccounts) {
      const transactions: BridgeTransaction[] = await this.aggregator.getTransactions(
        accessToken,
        Number(account.reference),
        serviceAccount.config as ClientConfig,
      );
      const algoanTransactions: PostBanksUserTransactionDTO[] = await mapBridgeTransactions(
        transactions,
        accessToken,
        this.aggregator,
        serviceAccount.config as ClientConfig,
      );
      await banksUser.createTransactions(account.id, algoanTransactions);
    }

    /**
     * 4. Notify Algoan that the process is finished
     */
    await banksUser.update({
      status: BanksUserStatus.FINISHED,
    });

    return;
  }
}
