import { Injectable } from '@nestjs/common';
import { BridgeClient } from './bridge/bridge.client';

/**
 * AggregatorService
 */
@Injectable()
export class AggregatorService {
  constructor(private readonly bridgeClient: BridgeClient) {}
}
