import { HttpService, Injectable, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';
import { AxiosResponse } from 'axios';
import { BaseResponse, UserAccount } from '../../interfaces/bridge.interface';

/**
 * BridgeClient
 */
@Injectable()
export class BridgeClient {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Creates a bridge user
   */
  public async register(userAccount: UserAccount): Promise<BaseResponse> {
    const url: string = `${config.bridge.baseUrl}/users?email=${userAccount.email}&password=${userAccount.password}`;

    const resp: AxiosResponse<BaseResponse> = await this.httpService
      .post(url, {
        client_id: config.bridge.clientId,
        client_secret: config.bridge.clientSecret,
        bankin_version: config.bridge.bankinVersion,
      })
      .toPromise();
    Logger.debug(`User created with email ${userAccount.email}`);

    return resp.data;
  }
  
}
