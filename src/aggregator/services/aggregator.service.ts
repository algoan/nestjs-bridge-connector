import { Injectable } from '@nestjs/common';
import { UserResponse, UserAccount, AuthenticationResponse } from '../interfaces/bridge.interface';
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
  public async registerClient(userAccount: UserAccount): Promise<UserResponse> {
    return this.bridgeClient.register(userAccount);
  }

  /**
   * Authenticate the current user
   */
  public async authenticateClient(userAccount: UserAccount): Promise<AuthenticationResponse> {
    return this.bridgeClient.authenticate(userAccount);
  }
}
