import { Injectable } from '@nestjs/common';
import { IBanksUser } from '@algoan/rest';
import { UserAccount, BridgeAccount, BridgeTransaction } from '../interfaces/bridge.interface';
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
  public async getAccessToken(banksUser: IBanksUser, clientConfig?: ClientConfig): Promise<string> {
    return (await this.bridgeClient.authenticate(AggregatorService.buildCredentials(banksUser), clientConfig))
      .access_token;
  }

  /**
   * Build Bridge account credentials for a BankUser
   *
   * @param bankUser
   */
  private static buildCredentials(bankUser: IBanksUser): UserAccount {
    return {
      // bankUser.createdAt should exist, need to change the interface
      email: `${bankUser.id}@algoan-bridge.com`,
      password: `${bankUser.id}`,
    };
  }

  /**
   * Get a bridge resource by uri
   */
  public async getResourceName(accessToken: string, bridgeUri: string, clientConfig?: ClientConfig): Promise<string> {
    return this.bridgeClient.getResourceName(accessToken, bridgeUri, clientConfig);
  }
}
