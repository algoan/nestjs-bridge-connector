import { Module } from '@nestjs/common';

import { AggregatorModule } from '../aggregator/aggregator.module';
import { AlgoanModule } from '../algoan/algoan.module';
import { ConfigModule } from '../config/config.module';
import { HooksController } from './controllers/hooks.controller';
import { HooksService } from './services/hooks.service';

/**
 * Hooks module
 */
@Module({
  imports: [AggregatorModule, AlgoanModule, ConfigModule],
  controllers: [HooksController],
  providers: [HooksService],
})
export class HooksModule {}
