import { HttpService, Injectable, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';
import { AxiosResponse } from 'axios';
import {
  UserResponse,
  UserAccount,
  AuthenticationResponse,
  ConnectItemResponse,
  ListAccountsResponse,
  BridgeAccount,
  BridgeTransaction,
  ListTransactionsResponse,
} from '../../interfaces/bridge.interface';

/**
 * BridgeClient
 */
@Injectable()
export class BridgeClient {
  constructor(private readonly httpService: HttpService) {
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.post['Client-Id'] = config.bridge.clientId;
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.post['Client-Secret'] = config.bridge.clientSecret;
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.post['Bankin-Version'] = config.bridge.bankinVersion;

    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.get['Client-Id'] = config.bridge.clientId;
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.get['Client-Secret'] = config.bridge.clientSecret;
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.get['Bankin-Version'] = config.bridge.bankinVersion;
  }

  /**
   * Creates a bridge user
   */
  public async register(userAccount: UserAccount): Promise<UserResponse> {
    const url: string = `${config.bridge.baseUrl}/users`;

    const resp: AxiosResponse<UserResponse> = await this.httpService.post(url, userAccount).toPromise();
    Logger.debug(`User created with email ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async authenticate(userAccount: UserAccount): Promise<AuthenticationResponse> {
    const url: string = `${config.bridge.baseUrl}/authenticate`;
    const resp: AxiosResponse<AuthenticationResponse> = await this.httpService.post(url, userAccount).toPromise();
    Logger.debug(`Authenticated user ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async connectItem(accessToken: string): Promise<ConnectItemResponse> {
    const url: string = `${config.bridge.baseUrl}/connect/items/add/url?country=fr`;

    const resp: AxiosResponse<ConnectItemResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .toPromise();

    return resp.data;
  }

  /**
   * Get a bridge user's accounts
   */
  public async getAccounts(accessToken: string): Promise<BridgeAccount[]> {
    const url: string = `${config.bridge.baseUrl}/accounts`;

    const resp: AxiosResponse<ListAccountsResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .toPromise();

    return resp.data.resources;
  }

  /**
   * Get a bridge account's transactions
   */
  public async getTransactions(accessToken: string, accountNumber: number): Promise<BridgeTransaction[]> {
    const url: string = `${config.bridge.baseUrl}/accounts/${accountNumber}/transactions`;

    const resp: AxiosResponse<ListTransactionsResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .toPromise();

    return resp.data.resources;
  }
}
