import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { BridgeClient } from './bridge.client';

describe('BridgeClient', () => {
  let service: BridgeClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, AlgoanModule],
      providers: [BridgeClient],
    }).compile();

    service = module.get<BridgeClient>(BridgeClient);
  });
});
