import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { BaseResponse } from '../interfaces/bridge.interface';
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

    service = module.get<AggregatorService>(AggregatorService);
    client = module.get<BridgeClient>(BridgeClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register user on brige', async () => {
    const mockResponse: BaseResponse = {
      uuid: 'mockUuid',
      resource_type: 'user',
      resource_uri: 'mockUri',
      email: 'mock@email.com',
    };
    const spy = jest.spyOn(client, 'register').mockReturnValue(Promise.resolve(mockResponse));
    await service.registerClient({ email: 'mock@email.com', password: 'mockPassword' });

    expect(spy).toBeCalledWith({ email: 'mock@email.com', password: 'mockPassword' });
  });
});
