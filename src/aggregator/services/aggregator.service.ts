import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { IBanksUser } from '@algoan/rest';
import { config } from 'node-config-ts';
import { has } from 'lodash';
import { UserAccount, BridgeAccount, BridgeTransaction, AuthenticationResponse } from '../interfaces/bridge.interface';
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
  public async generateRedirectUrl(banksUser: IBanksUser, clientConfig?: ClientConfig): Promise<string> {
    const userAccount: UserAccount = AggregatorService.buildCredentials(banksUser);
    await this.bridgeClient.register(userAccount, clientConfig);
    const authenticationResponse = await this.bridgeClient.authenticate(userAccount, clientConfig);
    const redirectResponse = await this.bridgeClient.connectItem(authenticationResponse.access_token, clientConfig);

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
  public async getTransactions(accessToken: string, clientConfig?: ClientConfig): Promise<BridgeTransaction[]> {
    return this.bridgeClient.getTransactions(accessToken, clientConfig);
  }

  /**
   * Returns the Bridge Access Token for a User
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public async getAccessToken(banksUser: IBanksUser, clientConfig?: ClientConfig): Promise<AuthenticationResponse> {
    return this.bridgeClient.authenticate(AggregatorService.buildCredentials(banksUser), clientConfig);
  }

  /**
   * Get a bridge resource by uri
   */
  public async getResourceName(accessToken: string, bridgeUri: string, clientConfig?: ClientConfig): Promise<string> {
    return this.bridgeClient.getResourceName(accessToken, bridgeUri, clientConfig);
  }

  /**
   * Delete a user from Bridge
   * @param banksUser
   */
  public async deleteUser(
    params: { bridgeUserId: string; accessToken: string; banksUser: IBanksUser },
    clientConfig?: ClientConfig,
  ): Promise<void> {
    const { password } = AggregatorService.buildCredentials(params.banksUser);

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
  private static buildCredentials(banksUser: IBanksUser): UserAccount {
    const password: string = config.banksUserIdPassword;
    let hash: string = createHmac('sha256', password).update(banksUser.id).digest('hex');
    const maxPasswordLength: number = 72;

    if (hash.length > maxPasswordLength) {
      hash = hash.slice(0, maxPasswordLength);
    }

    return {
      email: `${banksUser.id}@algoan-bridge.com`,
      password: hash,
    };
  }
}
