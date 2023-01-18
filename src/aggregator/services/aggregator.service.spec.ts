import { HttpModule } from '@nestjs/axios';
import { CacheModule, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { AlgoanModule } from '../../algoan/algoan.module';
import { customerMock } from '../../algoan/dto/customer.objects.mock';
import { AppModule } from '../../app.module';
import {
  mockAccount,
  mockAuthResponse,
  mockPersonalInformation,
  mockRefreshStatus,
  mockTransaction,
} from '../interfaces/bridge-mock';
import { AggregatorService } from './aggregator.service';
import { BridgeClient } from './bridge/bridge.client';

describe('AggregatorService', () => {
  let service: AggregatorService;
  let client: BridgeClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register({}), AppModule, HttpModule, AlgoanModule],
      providers: [AggregatorService, BridgeClient],
    }).compile();

    service = module.get<AggregatorService>(AggregatorService);
    client = module.get<BridgeClient>(BridgeClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRedirectUrl', () => {
    it('should not throw when the user already exists', async () => {
      const errorConflict: Error & { response: { status: number } } = new Error('user already exists') as Error & {
        response: { status: number };
      };
      errorConflict.response = { status: HttpStatus.CONFLICT };
      const registerSpy = jest.spyOn(client, 'register').mockResolvedValueOnce(Promise.reject(errorConflict));
      const authenticateSpy = jest.spyOn(client, 'authenticate').mockResolvedValueOnce({
        access_token: 'access-token',
        expires_at: '2019-05-06T11:08:25.040Z',
        user: {
          uuid: 'c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          email: 'john.doe@email.com',
        },
      });
      const connectItemSpy = jest.spyOn(client, 'connectItem').mockResolvedValueOnce({
        redirect_url: 'https://bridge/redirection-url',
      });

      const redirectUrl = await service.generateRedirectUrl(customerMock.id);
      const expectedPassword: string = createHmac('sha256', 'random_pass').update(customerMock.id).digest('hex');
      expect(registerSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(authenticateSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(connectItemSpy).toHaveBeenCalledWith('access-token', undefined, undefined, undefined);
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });
    it('should create and setup an account and return the redirect link', async () => {
      const registerSpy = jest.spyOn(client, 'register').mockResolvedValueOnce({
        uuid: '79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        email: 'john.doe@email.com',
      });
      const authenticateSpy = jest.spyOn(client, 'authenticate').mockResolvedValueOnce({
        access_token: 'access-token',
        expires_at: '2019-05-06T11:08:25.040Z',
        user: {
          uuid: 'c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          email: 'john.doe@email.com',
        },
      });
      const connectItemSpy = jest.spyOn(client, 'connectItem').mockResolvedValueOnce({
        redirect_url: 'https://bridge/redirection-url',
      });

      const redirectUrl = await service.generateRedirectUrl(customerMock.id);
      const expectedPassword: string = createHmac('sha256', 'random_pass').update(customerMock.id).digest('hex');
      expect(registerSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(authenticateSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(connectItemSpy).toHaveBeenCalledWith('access-token', undefined, undefined, undefined);
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });

    it('should create and setup an account and return the redirect link with a pre-fill email', async () => {
      const email: string = 'test@test.com';
      const registerSpy = jest.spyOn(client, 'register').mockResolvedValueOnce({
        uuid: '79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        email: 'john.doe@email.com',
      });
      const authenticateSpy = jest.spyOn(client, 'authenticate').mockResolvedValueOnce({
        access_token: 'access-token',
        expires_at: '2019-05-06T11:08:25.040Z',
        user: {
          uuid: 'c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          email: 'john.doe@email.com',
        },
      });
      const connectItemSpy = jest.spyOn(client, 'connectItem').mockResolvedValueOnce({
        redirect_url: 'https://bridge/redirection-url',
      });

      const redirectUrl = await service.generateRedirectUrl(customerMock.id, email);
      const expectedPassword: string = createHmac('sha256', 'random_pass').update(customerMock.id).digest('hex');
      expect(registerSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(authenticateSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(connectItemSpy).toHaveBeenCalledWith('access-token', email, undefined, undefined);
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });

    it('should not try to re-create a user that already exist', async () => {
      // TODO
    });

    it('should not try to re-create an item when there is one already', async () => {
      // TODO
    });

    it('should create and setup an account and return the redirect link with a context containg the customIdentifier', async () => {
      const email: string = 'test@test.com';
      const registerSpy = jest.spyOn(client, 'register').mockResolvedValueOnce({
        uuid: '79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        email: 'john.doe@email.com',
      });
      const authenticateSpy = jest.spyOn(client, 'authenticate').mockResolvedValueOnce({
        access_token: 'access-token',
        expires_at: '2019-05-06T11:08:25.040Z',
        user: {
          uuid: 'c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          email: 'john.doe@email.com',
        },
      });
      const connectItemSpy = jest.spyOn(client, 'connectItem').mockResolvedValueOnce({
        redirect_url: 'https://bridge/redirection-url',
      });

      const redirectUrl = await service.generateRedirectUrl(
        customerMock.id,
        email,
        undefined,
        customerMock.customIdentifier,
      );
      const expectedPassword: string = createHmac('sha256', 'random_pass').update(customerMock.id).digest('hex');
      expect(registerSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(authenticateSpy).toHaveBeenCalledWith(
        {
          email: `${customerMock.id}@algoan-bridge.com`,
          password: expectedPassword,
        },
        undefined,
      );
      expect(connectItemSpy).toHaveBeenCalledWith('access-token', email, undefined, customerMock.customIdentifier);
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });
  });

  it('should refresh an item', async () => {
    const spy = jest.spyOn(client, 'refreshItem').mockReturnValue(Promise.resolve());
    const itemId = 'mockItemId';
    const token = 'mockToken';
    await service.refresh(itemId, token);

    expect(spy).toBeCalledWith(itemId, token, undefined);
  });

  it('should refresh an item', async () => {
    const spy = jest.spyOn(client, 'getRefreshStatus').mockReturnValue(Promise.resolve(mockRefreshStatus));
    const itemId = 'mockItemId';
    const token = 'mockToken';
    await service.getRefreshStatus(itemId, token);

    expect(spy).toBeCalledWith(itemId, token, undefined);
  });

  it('should get the accounts', async () => {
    const spy = jest.spyOn(client, 'getAccounts').mockReturnValue(Promise.resolve([mockAccount]));
    const token = 'token';
    await service.getAccounts(token);

    expect(spy).toBeCalledWith(token, undefined);
  });

  it('should get the transactions', async () => {
    const spy = jest.spyOn(client, 'getTransactions').mockReturnValue(Promise.resolve([mockTransaction]));
    const token = 'token';
    await service.getTransactions(token, undefined);

    expect(spy).toBeCalledWith(token, undefined, undefined);
  });

  it('should get the accessToken', async () => {
    const spy = jest.spyOn(client, 'authenticate').mockReturnValue(Promise.resolve(mockAuthResponse));
    const accessToken = (await service.getAccessToken(customerMock.id)).access_token;
    const expectedPassword: string = createHmac('sha256', 'random_pass').update(customerMock.id).digest('hex');

    expect(spy).toBeCalledWith(
      {
        email: `${customerMock.id}@algoan-bridge.com`,
        password: expectedPassword,
      },
      undefined,
    );
    expect(accessToken).toEqual(mockAuthResponse.access_token);
  });

  it('should get the resource name', async () => {
    const spy = jest.spyOn(client, 'getResourceName').mockReturnValue(Promise.resolve('mockResourceName'));
    const token = 'token';
    const resourceUri = 'mockResourceUri';
    await service.getResourceName(token, resourceUri);

    expect(spy).toBeCalledWith(token, resourceUri, undefined);
  });

  it('should get the personal information from the user', async () => {
    const spy = jest
      .spyOn(client, 'getUserPersonalInformation')
      .mockReturnValue(Promise.resolve(mockPersonalInformation));
    const token = 'token';
    await service.getUserPersonalInformation(token);

    expect(spy).toBeCalledWith(token, undefined);
  });
});
