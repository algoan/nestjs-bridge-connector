import { CacheModule, HttpModule, Inject, Module } from '@nestjs/common';
import { AlgoanModule } from '../algoan/algoan.module';
import { AggregatorService } from './services/aggregator.service';
import { BridgeClient } from './services/bridge/bridge.client';

/**
 * AggregatorModule
 */
@Module({
  imports: [CacheModule.register(), HttpModule, AlgoanModule],
  providers: [AggregatorService, BridgeClient],
  exports: [AggregatorService],
})
export class AggregatorModule {}
