import { HttpService, Injectable, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';
import { AxiosResponse, AxiosRequestConfig } from 'axios';
import {
  UserResponse,
  UserAccount,
  AuthenticationResponse,
  ConnectItemResponse,
  ListAccountsResponse,
  BridgeAccount,
  BridgeTransaction,
  ListTransactionsResponse,
  BridgeBank,
  BridgeCategory,
} from '../../interfaces/bridge.interface';

/**
 * BridgeClient
 */
@Injectable()
export class BridgeClient {
  /**
   * Private logger
   */
  private readonly logger: Logger = new Logger(BridgeClient.name);

  constructor(private readonly httpService: HttpService) {
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.common['Client-Id'] = config.bridge.clientId;
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.common['Client-Secret'] = config.bridge.clientSecret;
    // eslint-disable-next-line @typescript-eslint/tslint/config
    this.httpService.axiosRef.defaults.headers.common['Bankin-Version'] = config.bridge.bankinVersion;
  }

  /**
   * Creates a bridge user
   */
  public async register(userAccount: UserAccount): Promise<UserResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/users`;

    const resp: AxiosResponse<UserResponse> = await this.httpService.post(url, userAccount).toPromise();
    this.logger.debug(`User created with email ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async authenticate(userAccount: UserAccount): Promise<AuthenticationResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/authenticate`;
    const resp: AxiosResponse<AuthenticationResponse> = await this.httpService.post(url, userAccount).toPromise();
    this.logger.debug(`Authenticated user ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async connectItem(accessToken: string): Promise<ConnectItemResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/connect/items/add/url?country=fr`;

    const resp: AxiosResponse<ConnectItemResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .toPromise();

    return resp.data;
  }

  /**
   * Get a bridge user's accounts
   */
  public async getAccounts(accessToken: string): Promise<BridgeAccount[]> {
    const url: string = `${config.bridge.baseUrl}/v2/accounts`;

    const resp: AxiosResponse<ListAccountsResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .toPromise();

    return resp.data.resources;
  }

  /**
   * Get a bridge account's transactions
   */
  public async getTransactions(accessToken: string, accountNumber: number): Promise<BridgeTransaction[]> {
    const url: string = `${config.bridge.baseUrl}/v2/accounts/${accountNumber}/transactions`;

    const resp: AxiosResponse<ListTransactionsResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .toPromise();

    return resp.data.resources;
  }

  /**
   * Get a bridge resource by uri
   */
  public async getResourceName(accessToken: string, bridgeUri: string): Promise<string> {
    const url: string = `${config.bridge.baseUrl}${bridgeUri}`;

    try {
      const resp: AxiosResponse<BridgeBank | BridgeCategory> = await this.httpService
        .get(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        .toPromise();

      return resp.data.name;
    } catch (err) {
      this.logger.warn({
        message: `An error occurred while retrieving ${bridgeUri}`,
        err,
      });

      return 'UNKNOWN';
    }
  }
}
