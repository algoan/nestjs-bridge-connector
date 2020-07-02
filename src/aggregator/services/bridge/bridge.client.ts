import { Injectable, LoggerService } from '@nestjs/common';

/**
 * BridgeClient
 */
@Injectable()
export class BridgeClient {
  constructor(private readonly logger: LoggerService) {}
}
