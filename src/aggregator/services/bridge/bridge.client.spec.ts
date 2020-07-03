import { HttpModule, HttpService } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { config } from 'node-config-ts';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { UserResponse, AuthenticationResponse } from '../../interfaces/bridge.interface';
import { BridgeClient } from './bridge.client';

describe('BridgeClient', () => {
  let service: BridgeClient;
  let httpService: HttpService;
  const userResponse: UserResponse = {
    uuid: 'mockUuid',
    resource_type: 'user',
    resource_uri: 'mockUri',
    email: 'mock@email.com',
  };

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

  it('can create a user', async () => {
    const result: AxiosResponse = {
      data: userResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const resp = await service.register({ email: 'mock@email.com', password: 'mockPassword' });
    expect(resp).toBe(userResponse);

    expect(spy).toHaveBeenCalledWith('https://sync.bankin.com/v2/users', {
      headers: {
        client_id: config.bridge.clientId,
        client_secret: config.bridge.clientSecret,
        bankin_version: '2019-02-18',
      },
      data: { email: 'mock@email.com', password: 'mockPassword' },
    });
  });

  it('can authenticate a user', async () => {
    const authResponse: AuthenticationResponse = {
      user: userResponse,
      access_token: 'mockAccessToken',
      expires_at: 'mockDate',
    };
    const result: AxiosResponse = {
      data: authResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const resp = await service.authenticate({ email: 'mock@email.com', password: 'mockPassword' });
    expect(resp).toBe(authResponse);

    expect(spy).toHaveBeenCalledWith('https://sync.bankin.com/v2/authenticate', {
      headers: {
        client_id: config.bridge.clientId,
        client_secret: config.bridge.clientSecret,
        bankin_version: '2019-02-18',
      },
      data: { email: 'mock@email.com', password: 'mockPassword' },
    });
  });
});
