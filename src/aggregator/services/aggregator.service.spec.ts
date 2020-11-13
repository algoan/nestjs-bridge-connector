import { createHmac } from 'crypto';
import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BanksUserStatus, BanksUser, RequestBuilder } from '@algoan/rest';
import { v4 as uuidV4 } from 'uuid';

import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { mockAccount, mockTransaction, mockAuthResponse } from '../interfaces/bridge-mock';
import { AggregatorService } from './aggregator.service';
import { BridgeClient } from './bridge/bridge.client';

describe('AggregatorService', () => {
  let service: AggregatorService;
  let client: BridgeClient;
  let uuid: string = uuidV4();
  const callbackUrl: string = `http://algoan.com/callback/2/${uuid}`;
  const mockBanksUser = new BanksUser(
    {
      id: 'mockBanksUserId',
      status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
      redirectUrl: 'mockRedirectUrl',
      redirectUrlCreatedAt: 123456789,
      redirectUrlTTL: 100,
      callbackUrl,
      scores: [],
      analysis: { alerts: [], regularCashFlows: [], reliability: 'HIGH' },
    },
    new RequestBuilder('mockBaseURL', { clientId: 'mockClientId' }),
  );

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

  describe('generateRedirectUrl', () => {
    it('should create and setup an account and return the redirect link', async () => {
      const registerSpy = jest.spyOn(client, 'register').mockResolvedValueOnce({
        uuid: '79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        resource_type: 'user',
        resource_uri: '/v2/users/79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        email: 'john.doe@email.com',
      });
      const authenticateSpy = jest.spyOn(client, 'authenticate').mockResolvedValueOnce({
        access_token: 'access-token',
        expires_at: '2019-05-06T11:08:25.040Z',
        user: {
          uuid: 'c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          resource_uri: '/v2/users/c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          resource_type: 'user',
          email: 'john.doe@email.com',
        },
      });
      const connectItemSpy = jest.spyOn(client, 'connectItem').mockResolvedValueOnce({
        redirect_url: 'https://bridge/redirection-url',
      });

      const redirectUrl = await service.generateRedirectUrl(mockBanksUser);
      const expectedPassword: string = createHmac('sha256', 'random_pass').update('mockBanksUserId').digest('hex');
      expect(registerSpy).toHaveBeenCalledWith(
        {
          email: 'mockBanksUserId@algoan-bridge.com',
          password: expectedPassword,
        },
        undefined,
      );
      expect(authenticateSpy).toHaveBeenCalledWith(
        {
          email: 'mockBanksUserId@algoan-bridge.com',
          password: expectedPassword,
        },
        undefined,
      );
      const extractedUuid: string = uuid.replace(/-/g, 'z');
      expect(connectItemSpy).toHaveBeenCalledWith('access-token', extractedUuid, undefined, undefined);
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });

    it('should create and setup an account and return the redirect link with a prefill email', async () => {
      const email: string = 'test@test.com';
      const registerSpy = jest.spyOn(client, 'register').mockResolvedValueOnce({
        uuid: '79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        resource_type: 'user',
        resource_uri: '/v2/users/79c8961c-bdf7-11e5-88a3-4f2c2aec0665',
        email: 'john.doe@email.com',
      });
      const authenticateSpy = jest.spyOn(client, 'authenticate').mockResolvedValueOnce({
        access_token: 'access-token',
        expires_at: '2019-05-06T11:08:25.040Z',
        user: {
          uuid: 'c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          resource_uri: '/v2/users/c2a26c9e-dc23-4f67-b887-bbae0f26c415',
          resource_type: 'user',
          email: 'john.doe@email.com',
        },
      });
      const connectItemSpy = jest.spyOn(client, 'connectItem').mockResolvedValueOnce({
        redirect_url: 'https://bridge/redirection-url',
      });

      const redirectUrl = await service.generateRedirectUrl(mockBanksUser, email);
      const expectedPassword: string = createHmac('sha256', 'random_pass').update('mockBanksUserId').digest('hex');
      expect(registerSpy).toHaveBeenCalledWith(
        {
          email: 'mockBanksUserId@algoan-bridge.com',
          password: expectedPassword,
        },
        undefined,
      );
      expect(authenticateSpy).toHaveBeenCalledWith(
        {
          email: 'mockBanksUserId@algoan-bridge.com',
          password: expectedPassword,
        },
        undefined,
      );
      const extractedUuid: string = uuid.replace(/-/g, 'z');
      expect(connectItemSpy).toHaveBeenCalledWith('access-token', extractedUuid, email, undefined);
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });

    it('should not try to re-create a user that already exist', async () => {
      // TODO
    });

    it('should not try to re-create an item when there is one already', async () => {
      // TODO
    });
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
    const accessToken = (await service.getAccessToken(mockBanksUser)).access_token;
    const expectedPassword: string = createHmac('sha256', 'random_pass').update('mockBanksUserId').digest('hex');

    expect(spy).toBeCalledWith(
      {
        email: 'mockBanksUserId@algoan-bridge.com',
        password: expectedPassword,
      },
      undefined,
    );
    expect(accessToken).toEqual(mockAuthResponse.access_token);
  });

  it('should get the resource name', async () => {
    const spy = jest.spyOn(client, 'getResourceName').mockReturnValue(Promise.resolve('mockResourceName'));
    const token = 'token';
    const resourceUri = 'mockResoruceUri';
    await service.getResourceName(token, resourceUri);

    expect(spy).toBeCalledWith(token, resourceUri, undefined);
  });
});
