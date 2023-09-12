import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Cache } from 'cache-manager';
import { isNil } from 'lodash';
import { config } from 'node-config-ts';
import { lastValueFrom, Observable } from 'rxjs';
import { AccountBank } from '../../../algoan/dto/analysis.inputs';
import {
  AccountInformation,
  AuthenticationResponse,
  BrideConnectItemDTO,
  BridgeAccount,
  BridgeBank,
  BridgeCategory,
  BridgeRefreshStatus,
  BridgeTransaction,
  BridgeUserInformation,
  ConnectItemResponse,
  ListResponse,
  UserAccount,
  UserResponse,
} from '../../interfaces/bridge.interface';

/**
 * Bridge Client Config
 */
export interface ClientConfig {
  clientId: string;
  clientSecret: string;
  bankinVersion: string;
  nbOfMonths?: number;
  deleteBridgeUsers?: boolean;
  parentUrl?: string;
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

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache, private readonly httpService: HttpService) {
    if (config.activateBridgeRequestInterceptor) {
      this.httpService.axiosRef.interceptors.request.use((_config: AxiosRequestConfig): AxiosRequestConfig => {
        this.logger.log({
          config: _config,
          message: `${_config.method} ${_config.url} - Request to Bridge`,
        });

        return _config;
      });
      this.httpService.axiosRef.interceptors.response.use(
        async (response: AxiosResponse) => {
          this.logger.log({
            message: `${response.config.method} ${response.config.url} - successfully responded`,
            body: response.data,
            headers: response.headers,
          });

          return Promise.resolve(response);
        },
        async (error: AxiosError) => {
          this.logger.error({ message: error.message, data: error.response?.data }, error.stack, error.message);

          return Promise.reject(error);
        },
      );
    }
  }

  /**
   * Creates a bridge user
   */
  public async register(userAccount: UserAccount, clientConfig?: ClientConfig): Promise<UserResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/users`;

    const resp: AxiosResponse<UserResponse> = await BridgeClient.toPromise(
      this.httpService.post(url, userAccount, { headers: { ...BridgeClient.getHeaders(clientConfig) } }),
    );
    this.logger.debug(`User created with email ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async authenticate(userAccount: UserAccount, clientConfig?: ClientConfig): Promise<AuthenticationResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/authenticate`;
    const resp: AxiosResponse<AuthenticationResponse> = await BridgeClient.toPromise(
      this.httpService.post(url, userAccount, { headers: { ...BridgeClient.getHeaders(clientConfig) } }),
    );
    this.logger.debug(`Authenticated user ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async connectItem(
    accessToken: string,
    email?: string,
    clientConfig?: ClientConfig,
    customIdentifier?: string,
  ): Promise<ConnectItemResponse> {
    const url: string = `${config.bridge.baseUrl}/v2/connect/items/add`;
    const data: BrideConnectItemDTO = {
      country: 'fr',
      prefill_email: email,
      parent_url: clientConfig?.parentUrl,
    };

    if (customIdentifier !== undefined) {
      data.context = customIdentifier;
    }

    const resp: AxiosResponse<ConnectItemResponse> = await BridgeClient.toPromise(
      this.httpService.post(url, data, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      }),
    );

    return resp.data;
  }

  /**
   * Refresh an item
   */
  public async refreshItem(id: string | number, accessToken: string, clientConfig?: ClientConfig): Promise<void> {
    const url: string = `${config.bridge.baseUrl}/v2/items/${id}/refresh`;
    await BridgeClient.toPromise(
      this.httpService.post(url, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      }),
    );
  }

  /**
   * Get status of a refresh
   */
  public async getRefreshStatus(
    id: string | number,
    accessToken: string,
    clientConfig?: ClientConfig,
  ): Promise<BridgeRefreshStatus> {
    const url: string = `${config.bridge.baseUrl}/v2/items/${id}/refresh/status`;
    const resp: AxiosResponse<BridgeRefreshStatus> = await BridgeClient.toPromise(
      this.httpService.get(url, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      }),
    );

    return resp.data;
  }

  /**
   * Get a bridge user's accounts
   */
  public async getAccounts(accessToken: string, clientConfig?: ClientConfig): Promise<BridgeAccount[]> {
    const url: string = `${config.bridge.baseUrl}/v2/accounts`;

    const resp: AxiosResponse<ListResponse<BridgeAccount>> = await BridgeClient.toPromise(
      this.httpService.get(url, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      }),
    );

    return resp.data.resources;
  }

  /**
   * Get a bridge account's transactions
   */
  public async getTransactions(
    accessToken: string,
    clientConfig?: ClientConfig,
    lastUpdatedAt?: string | undefined,
    nextUri?: string,
    transactions?: BridgeTransaction[],
  ): Promise<BridgeTransaction[]> {
    const uri: string =
      nextUri ?? `/v2/transactions/updated?limit=100${!isNil(lastUpdatedAt) ? `&since=${lastUpdatedAt}` : ''}`;
    const url: string = `${config.bridge.baseUrl}${uri}`;

    const resp: AxiosResponse<ListResponse<BridgeTransaction>> = await BridgeClient.toPromise(
      this.httpService.get(url, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      }),
    );

    const mergedTransactions: BridgeTransaction[] = [...(transactions ?? []), ...resp.data.resources];

    if (!isNil(resp.data.pagination.next_uri)) {
      return this.getTransactions(
        accessToken,
        clientConfig,
        lastUpdatedAt,
        resp.data.pagination.next_uri,
        mergedTransactions,
      );
    }

    return mergedTransactions;
  }

  /**
   * Get a bridge resource by uri
   */
  public async getResourceName(accessToken: string, bridgeUri: string, clientConfig?: ClientConfig): Promise<string> {
    const url: string = `${config.bridge.baseUrl}${bridgeUri}`;

    const cached: string = (await this.cacheManager.get(url)) as string;
    if (cached) {
      return cached;
    }

    try {
      const resp: AxiosResponse<BridgeCategory> = await BridgeClient.toPromise(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...BridgeClient.getHeaders(clientConfig),
          },
        }),
      );
      const { name } = resp.data;
      await this.cacheManager.set(url, name, { ttl: 86400 });

      return name;
    } catch (err) {
      this.logger.warn({
        message: `An error occurred while retrieving ${bridgeUri}`,
        err,
      });

      return 'UNKNOWN';
    }
  }

  /**
   * Get a bridge bank information resource by uri
   */
  public async getBankInformation(
    accessToken: string,
    bridgeUri: string,
    clientConfig?: ClientConfig,
  ): Promise<AccountBank> {
    const url: string = `${config.bridge.baseUrl}${bridgeUri}`;

    const cached: AccountBank | undefined = await this.cacheManager.get(url);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const resp: AxiosResponse<BridgeBank> = await BridgeClient.toPromise(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...BridgeClient.getHeaders(clientConfig),
          },
        }),
      );

      const bankInfo: AccountBank = {
        name: resp.data.name,
        logoUrl: resp.data.logo_url,
      };
      await this.cacheManager.set(url, bankInfo, { ttl: 86400 });

      return bankInfo;
    } catch (err) {
      this.logger.warn({
        message: `An error occurred while retrieving ${bridgeUri}`,
        err,
      });

      return { name: 'UNKNOWN' };
    }
  }

  /**
   * Delete a user
   * @param clientConfig Client configuration attached to Algoan's service account
   */
  public async deleteUser(
    accessToken: string,
    params: { userId: string; password: string },
    clientConfig?: ClientConfig,
  ): Promise<void> {
    const uri: string = `/v2/users/${params.userId}/delete`;
    const url: string = `${config.bridge.baseUrl}${uri}`;

    await BridgeClient.toPromise(
      this.httpService.post(
        url,
        {
          password: params.password,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...BridgeClient.getHeaders(clientConfig),
          },
        },
      ),
    );
  }

  /**
   * Get account information
   */
  public async getAccountInformation(accessToken: string, clientConfig?: ClientConfig): Promise<AccountInformation[]> {
    const url: string = `${config.bridge.baseUrl}/v2/accounts-information`;

    const resp: AxiosResponse<{ resources: AccountInformation[] }> = await BridgeClient.toPromise(
      this.httpService.get(url, {
        headers: { Authorization: `Bearer ${accessToken}`, ...BridgeClient.getHeaders(clientConfig) },
      }),
    );

    return resp.data.resources;
  }

  /**
   * Build the headers from the serviceAccount or from the default values in the config.bridge
   * @param clientConfig: configs found in  serviceAccount.config
   */
  private static getHeaders(clientConfig?: ClientConfig): {
    'Client-Id': string;
    'Client-Secret': string;
    'Bankin-Version': string;
  } {
    return {
      'Client-Id': clientConfig?.clientId ?? config.bridge.clientId,
      'Client-Secret': clientConfig?.clientSecret ?? config.bridge.clientSecret,
      'Bankin-Version': clientConfig?.bankinVersion ?? config.bridge.bankinVersion,
    };
  }

  /**
   * Convert an Observable to a promise
   * @param response Axios observable response
   * @returns Promisify observable
   */
  private static async toPromise<T>(response: Observable<T>): Promise<T> {
    return lastValueFrom(response);
  }
}
