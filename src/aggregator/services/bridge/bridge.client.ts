import { HttpService, Injectable, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';
import { AxiosResponse } from 'axios';
import { UserResponse, UserAccount, AuthenticationResponse } from '../../interfaces/bridge.interface';

/**
 * BridgeClient
 */
@Injectable()
export class BridgeClient {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Creates a bridge user
   */
  public async register(userAccount: UserAccount): Promise<UserResponse> {
    const url: string = `${config.bridge.baseUrl}/users?email=${userAccount.email}&password=${userAccount.password}`;

    const resp: AxiosResponse<UserResponse> = await this.httpService
      .post(url, {
        client_id: config.bridge.clientId,
        client_secret: config.bridge.clientSecret,
        bankin_version: config.bridge.bankinVersion,
      })
      .toPromise();
    Logger.debug(`User created with email ${userAccount.email}`);

    return resp.data;
  }

  /**
   * Authenticates a bridge user
   */
  public async authenticate(userAccount: UserAccount): Promise<AuthenticationResponse> {
    const url: string = `${config.bridge.baseUrl}/authenticate?email=${userAccount.email}&password=${userAccount.password}`;

    const resp: AxiosResponse<AuthenticationResponse> = await this.httpService
      .post(url, {
        client_id: config.bridge.clientId,
        client_secret: config.bridge.clientSecret,
        bankin_version: config.bridge.bankinVersion,
      })
      .toPromise();
    Logger.debug(`Authenticated user ${userAccount.email}`);

    return resp.data;
  }
}
