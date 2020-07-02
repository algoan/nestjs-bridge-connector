import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AggregatorService } from './aggregator.service';
import { BridgeClient } from './bridge/bridge.client';

describe('AggregatorService', () => {
  let service: AggregatorService;
  let client: BridgeClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, AlgoanModule],
      providers: [AggregatorService, BridgeClient],
    }).compile();
  });
});
