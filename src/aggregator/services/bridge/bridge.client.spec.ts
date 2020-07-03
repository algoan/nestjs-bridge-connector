import { HttpModule, HttpService } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { config } from 'node-config-ts';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { UserResponse, AuthenticationResponse, ConnectItemResponse } from '../../interfaces/bridge.interface';
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

  it('sets the right headers', () => {
    // eslint-disable-next-line @typescript-eslint/tslint/config
    expect(httpService.axiosRef.defaults.headers.post as unknown).toMatchObject({
      'Client-Id': config.bridge.clientId,
      'Client-Secret': config.bridge.clientSecret,
      'Bankin-Version': config.bridge.bankinVersion,
    });
    // eslint-disable-next-line @typescript-eslint/tslint/config
    expect(httpService.axiosRef.defaults.headers.get as unknown).toMatchObject({
      'Client-Id': config.bridge.clientId,
      'Client-Secret': config.bridge.clientSecret,
      'Bankin-Version': config.bridge.bankinVersion,
    });
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
      email: 'mock@email.com',
      password: 'mockPassword',
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
      email: 'mock@email.com',
      password: 'mockPassword',
    });
  });

  it('can connect a user to an item', async () => {
    const connectItemResponse: ConnectItemResponse = {
      redirect_url: 'the-redirect-url',
    };
    const result: AxiosResponse = {
      data: connectItemResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.connectItem('secret-access-token');
    expect(resp).toBe(connectItemResponse);

    expect(spy).toHaveBeenCalledWith('https://sync.bankin.com/v2/authenticate', {
      headers: {
        authorisation: 'Bearer secret-access-token',
      },
    });
  });
});
