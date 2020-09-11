import { HttpService, Injectable, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';
import { AxiosResponse } from 'axios';
import { isNil } from 'lodash';
import {
  UserResponse,
  UserAccount,
  AuthenticationResponse,
  ConnectItemResponse,
  ListResponse,
  BridgeAccount,
  BridgeTransaction,
  BridgeBank,
  BridgeCategory,
} from '../../interfaces/bridge.interface';

/**
 * Bridge Client Config
 */
export interface ClientConfig {
  clientId: string;
  clientSecret: string;
  bankinVersion: string;
}

/**
 * BridgeClient
 */
@Injectable()
export class BridgeClient {
  /**
   * Private logger
   */
  private readonly logger: Logger = new Logger(BridgeClient.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Creates a bridge user
   */
  public async register(userAccount: UserAccount, clientConfig?: ClientConfig): Promise<UserResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/users`;

    const resp: AxiosResponse<UserResponse> = await this.httpService
      .post(url, userAccount, { headers: { ...BridgeClient.getHeaders(clientConfig) } })
      .toPromise();
    this.logger.debug(`User created with email ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async authenticate(userAccount: UserAccount, clientConfig?: ClientConfig): Promise<AuthenticationResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/authenticate`;
    const resp: AxiosResponse<AuthenticationResponse> = await this.httpService
      .post(url, userAccount, { headers: { ...BridgeClient.getHeaders(clientConfig) } })
      .toPromise();
    this.logger.debug(`Authenticated user ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async connectItem(accessToken: string, clientConfig?: ClientConfig): Promise<ConnectItemResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/connect/items/add/url?country=fr`;

    const resp: AxiosResponse<ConnectItemResponse> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) } })
      .toPromise();

    return resp.data;
  }

  /**
   * Get a bridge user's accounts
   */
  public async getAccounts(accessToken: string, clientConfig?: ClientConfig): Promise<BridgeAccount[]> {
    const url: string = `${config.bridge.baseUrl}/v2/accounts`;

    const resp: AxiosResponse<ListResponse<BridgeAccount>> = await this.httpService
      .get(url, { headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) } })
      .toPromise();

    return resp.data.resources;
  }

  /**
   * Get a bridge account's transactions
   */
  public async getTransactions(
    accessToken: string,
    clientConfig?: ClientConfig,
    nextUri?: string,
    transactions?: BridgeTransaction[],
  ): Promise<BridgeTransaction[]> {
    const uri: string = nextUri ?? '/v2/transactions?limit=100';
    const url: string = `${config.bridge.baseUrl}${uri}`;

    const resp: AxiosResponse<ListResponse<BridgeTransaction>> = await this.httpService
      .get(url, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      })
      .toPromise();

    const mergedTransactions: BridgeTransaction[] = [...(transactions ?? []), ...resp.data.resources];

    if (!isNil(resp.data.pagination.next_uri)) {
      return this.getTransactions(accessToken, clientConfig, resp.data.pagination.next_uri, mergedTransactions);
    }

    return mergedTransactions;
  }

  /**
   * Get a bridge resource by uri
   */
  public async getResourceName(accessToken: string, bridgeUri: string, clientConfig?: ClientConfig): Promise<string> {
    const url: string = `${config.bridge.baseUrl}${bridgeUri}`;

    try {
      const resp: AxiosResponse<BridgeBank | BridgeCategory> = await this.httpService
        .get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...BridgeClient.getHeaders(clientConfig),
          },
        })
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

  /**
   * Build the headers from the serviceAccount or from the default values in the config.bridge
   * @param clientConfig: configs found in  serviceAccount.config
   */
  private static getHeaders(
    clientConfig?: ClientConfig,
  ): { 'Client-Id': string; 'Client-Secret': string; 'Bankin-Version': string } {
    return {
      'Client-Id': clientConfig?.clientId ?? config.bridge.clientId,
      'Client-Secret': clientConfig?.clientSecret ?? config.bridge.clientSecret,
      'Bankin-Version': clientConfig?.bankinVersion ?? config.bridge.bankinVersion,
    };
  }
}
