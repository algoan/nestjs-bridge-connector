import { createHmac } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { config } from 'node-config-ts';

import {
  AuthenticationResponse,
  BridgeAccount,
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
   * Create the Bridge Webview url base on the client and it's callbackUrl
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public async generateRedirectUrl(
    id: string,
    callbackUrl?: string,
    email?: string,
    clientConfig?: ClientConfig,
  ): Promise<string> {
    const userAccount: UserAccount = AggregatorService.buildCredentials(id);
    try {
      await this.bridgeClient.register(userAccount, clientConfig);
    } catch (err) {
      const error: Error & { code?: number } = err as Error & { code?: number };
      // Ignore error conflict user already exists
      if (error.code !== HttpStatus.CONFLICT) {
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
    const uuid: string = splittedCbUrl[splittedCbUrl.length - 1].replace(/-/g, 'z');

    const redirectResponse = await this.bridgeClient.connectItem(
      authenticationResponse.access_token,
      uuid,
      email,
      clientConfig,
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
   * @param banksUser The bank user for which we generate the redirectUrl
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
   * @param banksUser
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
   * @param banksUser
   */
  private static buildCredentials(id: string): UserAccount {
    const password: string = config.banksUserIdPassword;
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
