import { createHmac } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { config } from 'node-config-ts';
import { AccountBank } from '../../algoan/dto/analysis.inputs';
import {
  AuthenticationResponse,
  BridgeAccount,
  BridgeRefreshStatus,
  BridgeTransaction,
  BridgeUserInformation,
  UserAccount,
} from '../interfaces/bridge.interface';
import { BridgeClient, ClientConfig } from './bridge/bridge.client';

/**
 * AggregatorService
 */
@Injectable()
export class AggregatorService {
  constructor(private readonly bridgeClient: BridgeClient) {}

  /**
   * Refresh a connection
   * @param id id of the connection
   * @param accessToken access token of the connection
   */
  public async refresh(id: string | number, accessToken: string, clientConfig?: ClientConfig): Promise<void> {
    return this.bridgeClient.refreshItem(id, accessToken, clientConfig);
  }

  /**
   * Get the status of the refresh of a connection
   * @param id id of the connection
   * @param accessToken access token of the connection
   */
  public async getRefreshStatus(
    id: string | number,
    accessToken: string,
    clientConfig?: ClientConfig,
  ): Promise<BridgeRefreshStatus> {
    return this.bridgeClient.getRefreshStatus(id, accessToken, clientConfig);
  }

  /**
   * Create the Bridge Webview url base on the client and it's callbackUrl
   *
   * @param id id of the customer to generate a redirectUrl
   * @param callbackUrl callback url of the redirect url
   */
  public async generateRedirectUrl(
    id: string,
    callbackUrl?: string,
    email?: string,
    clientConfig?: ClientConfig,
    customIdentifier?: string,
  ): Promise<string> {
    const userAccount: UserAccount = AggregatorService.buildCredentials(id);
    try {
      await this.bridgeClient.register(userAccount, clientConfig);
    } catch (err) {
      const error: { response: { status: number } } = err as Error & { response: { status: number } };
      // Ignore error conflict user already exists
      if (error.response.status !== HttpStatus.CONFLICT) {
        throw error;
      }
    }
    const authenticationResponse = await this.bridgeClient.authenticate(userAccount, clientConfig);

    /**
     * Extract the uuid from the callback URL
     * As Bridge accepts only letters and numbers, replace "-" by a "z"
     */
    const splittedCbUrl: string[] | undefined = callbackUrl?.split('/');
    if (splittedCbUrl === undefined) {
      throw new Error('No callbackUrl provided');
    }
    const lastUrlSegment: string = splittedCbUrl[splittedCbUrl.length - 1];
    const lastUrlSegmentWithoutQueryParams: string = lastUrlSegment.split('?')[0];
    const uuid: string = lastUrlSegmentWithoutQueryParams.replace(/-/g, 'z');

    const redirectResponse = await this.bridgeClient.connectItem(
      authenticationResponse.access_token,
      uuid,
      email,
      clientConfig,
      customIdentifier,
    );

    return redirectResponse.redirect_url;
  }

  /**
   * Returns the Bridge Accounts for a user
   *
   */
  public async getAccounts(accessToken: string, clientConfig?: ClientConfig): Promise<BridgeAccount[]> {
    return this.bridgeClient.getAccounts(accessToken, clientConfig);
  }

  /**
   * Returns the Bridge Transactions for an account
   *
   */
  public async getTransactions(
    accessToken: string,
    lastUpdatedAt: string | undefined,
    clientConfig?: ClientConfig,
  ): Promise<BridgeTransaction[]> {
    return this.bridgeClient.getTransactions(accessToken, clientConfig, lastUpdatedAt);
  }

  /**
   * Returns the Bridge Access Token for a User
   *
   * @param id id of the customer
   */
  public async getAccessToken(id: string, clientConfig?: ClientConfig): Promise<AuthenticationResponse> {
    return this.bridgeClient.authenticate(AggregatorService.buildCredentials(id), clientConfig);
  }

  /**
   * Get a bridge resource by uri
   */
  public async getResourceName(accessToken: string, bridgeUri: string, clientConfig?: ClientConfig): Promise<string> {
    return this.bridgeClient.getResourceName(accessToken, bridgeUri, clientConfig);
  }

  /**
   * Get a bridge bank information by uri
   */
  public async getBankInformation(
    accessToken: string,
    bridgeUri: string,
    clientConfig?: ClientConfig,
  ): Promise<AccountBank> {
    return this.bridgeClient.getBankInformation(accessToken, bridgeUri, clientConfig);
  }

  /**
   * Returns the Bridge Personal information for a user
   */
  public async getUserPersonalInformation(
    accessToken: string,
    clientConfig?: ClientConfig,
  ): Promise<BridgeUserInformation[]> {
    return this.bridgeClient.getUserPersonalInformation(accessToken, clientConfig);
  }

  /**
   * Delete a user from Bridge
   * @param params.id id of the customer
   */
  public async deleteUser(
    params: { bridgeUserId: string; accessToken: string; id: string },
    clientConfig?: ClientConfig,
  ): Promise<void> {
    const { password } = AggregatorService.buildCredentials(params.id);

    return this.bridgeClient.deleteUser(
      params.accessToken,
      {
        password,
        userId: params.bridgeUserId,
      },
      clientConfig,
    );
  }

  /**
   * Build Bridge account credentials for a BankUser
   * https://docs.bridgeapi.io/docs/user-creation
   *
   * @param id id of the customer
   */
  private static buildCredentials(id: string): UserAccount {
    const password: string = config.customerIdPassword;
    let hash: string = createHmac('sha256', password).update(id).digest('hex');
    const maxPasswordLength: number = 72;

    if (hash.length > maxPasswordLength) {
      hash = hash.slice(0, maxPasswordLength);
    }

    return {
      email: `${id}@algoan-bridge.com`,
      password: hash,
    };
  }
}
