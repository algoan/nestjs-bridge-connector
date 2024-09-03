import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AlgoanAnalysisService } from './services/algoan-analysis.service';
import { AlgoanCustomerService } from './services/algoan-customer.service';
import { AlgoanHttpService } from './services/algoan-http.service';
import { AlgoanService } from './services/algoan.service';
import { AlgoanServiceAcountService } from './services/algoan-service-account.service';

/**
 * Algoan module
 */
@Module({
  imports: [ConfigModule],
  providers: [
    AlgoanAnalysisService,
    AlgoanCustomerService,
    AlgoanHttpService,
    AlgoanService,
    AlgoanServiceAcountService,
  ],
  exports: [AlgoanAnalysisService, AlgoanCustomerService, AlgoanHttpService, AlgoanService, AlgoanServiceAcountService],
})
export class AlgoanModule {}
