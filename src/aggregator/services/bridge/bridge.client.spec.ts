import { HttpModule, HttpService } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { config } from 'node-config-ts';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { BaseResponse } from '../../interfaces/bridge.interface';
import { BridgeClient } from './bridge.client';

describe('BridgeClient', () => {
  let service: BridgeClient;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, AlgoanModule],
      providers: [BridgeClient],
    }).compile();

    httpService = module.get<HttpService>(HttpService);
    service = module.get<BridgeClient>(BridgeClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns a base response when called', async () => {
    const mockResponse: BaseResponse = {
      uuid: 'mockUuid',
      resource_type: 'user',
      resource_uri: 'mockUri',
      email: 'mock@email.com',
    };
    const result: AxiosResponse = {
      data: mockResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const resp = await service.register({ email: 'mock@email.com', password: 'mockPassword' });
    expect(resp).toBe(mockResponse);

    expect(spy).toHaveBeenCalledWith('https://sync.bankin.com/v2/users?email=mock@email.com&password=mockPassword', {
      client_id: config.bridge.clientId,
      client_secret: config.bridge.clientSecret,
      bankin_version: '2019-02-18',
    });
  });
});
