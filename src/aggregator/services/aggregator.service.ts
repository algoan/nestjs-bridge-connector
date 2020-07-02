import { Injectable } from '@nestjs/common';
import { BaseResponse, UserAccount } from '../interfaces/bridge.interface';
import { BridgeClient } from './bridge/bridge.client';

/**
 * AggregatorService
 */
@Injectable()
export class AggregatorService {
  constructor(private readonly bridgeClient: BridgeClient) {}

  /**
   * Validate the creation of the current user
   */
  public async registerClient(userAccount: UserAccount): Promise<BaseResponse> {
    return this.bridgeClient.register(userAccount);
  }
}
