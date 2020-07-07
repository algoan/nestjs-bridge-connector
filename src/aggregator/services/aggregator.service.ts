import { Injectable } from '@nestjs/common';
import { IBanksUser } from '@algoan/rest';
import {
  UserResponse,
  UserAccount,
  AuthenticationResponse,
  BridgeAccount,
  BridgeTransaction,
} from '../interfaces/bridge.interface';
import { BridgeClient } from './bridge/bridge.client';

/**
 * AggregatorService
 */
@Injectable()
export class AggregatorService {
  constructor(private readonly bridgeClient: BridgeClient) {}

  // /**
  //  * Validate the creation of the current user
  //  */
  // public async registerClient(userAccount: UserAccount): Promise<UserResponse> {
  //   return this.bridgeClient.register(userAccount);
  // }

  // /**
  //  * Authenticate the current user
  //  */
  // public async authenticateClient(userAccount: UserAccount): Promise<AuthenticationResponse> {
  //   return this.bridgeClient.authenticate(userAccount);
  // }

  /**
   * Create the Bridge Webview url base on the client and it's callbackUrl
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public async generateRedirectUrl(banksUser: IBanksUser): Promise<string> {
    const userAccount = AggregatorService.buildCredentials(banksUser);
    await this.bridgeClient.register(userAccount);
    const authenticationResponse = await this.bridgeClient.authenticate(userAccount);
    const redirectResponse = await this.bridgeClient.connectItem(authenticationResponse.access_token);

    return redirectResponse.redirect_url;
  }

  /**
   * Returns the Bridge Accounts for a user
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public async getAccounts(accessToken: string): Promise<BridgeAccount[]> {
    return this.bridgeClient.getAccounts(accessToken);
  }

  /**
   * Returns the Bridge Transactions for an acount
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public async getTransactions(accessToken: string, accountNumber: number): Promise<BridgeTransaction[]> {
    return this.bridgeClient.getTransactions(accessToken, accountNumber);
  }

  /**
   * Returns the Bridge Access Token for a User
   *
   * @param banksUser The bank user for which we generate the redirectUrl
   */
  public async getAccessToken(banksUser: IBanksUser): Promise<string> {
    return (await this.bridgeClient.authenticate(AggregatorService.buildCredentials(banksUser))).access_token;
  }

  /**
   * Build Bridge account credentials for a BankUser
   *
   * @param bankUser
   */
  private static buildCredentials(bankUser: IBanksUser): UserAccount {
    return {
      // bankUser.createdAt should exist, need to change the interface
      email: `${bankUser.id}-bankUser.createdAt@algoan-bridge.com`,
      password: `${bankUser.id}-bankUser.createdAt`,
    };
  }
}
