import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BanksUserStatus, BanksUser, RequestBuilder } from '@algoan/rest';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { UserResponse } from '../interfaces/bridge.interface';
import { AggregatorService } from './aggregator.service';
import { BridgeClient } from './bridge/bridge.client';

describe('AggregatorService', () => {
  let service: AggregatorService;
  let client: BridgeClient;
  const userResponse: UserResponse = {
    uuid: 'mockUuid',
    resource_type: 'user',
    resource_uri: 'mockUri',
    email: 'mock@email.com',
  };

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

      const mockBanksUser = new BanksUser(
        {
          id: 'mockBanksUserId',
          status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
          redirectUrl: 'mockRedirectUrl',
          redirectUrlCreatedAt: 123456789,
          redirectUrlTTL: 100,
          callbackUrl: 'mockCallbackUrl',
          scores: [],
          analysis: { alerts: [], regularCashFlows: [], reliability: 'HIGH' },
        },
        new RequestBuilder('mockBaseURL', { clientId: 'mockClientId' }),
      );

      const redirectUrl = await service.generateRedirectUrl(mockBanksUser);
      expect(registerSpy).toHaveBeenCalledWith({
        email: 'mockBanksUserId-bankUser.createdAt@algoan-bridge.com',
        password: 'mockBanksUserId-bankUser.createdAt',
      });
      expect(authenticateSpy).toHaveBeenCalledWith({
        email: 'mockBanksUserId-bankUser.createdAt@algoan-bridge.com',
        password: 'mockBanksUserId-bankUser.createdAt',
      });
      expect(connectItemSpy).toHaveBeenCalledWith('access-token');
      expect(redirectUrl).toBe('https://bridge/redirection-url');
    });

    it('should not try to re-create a user that already exist', async () => {
      // TODO
    });

    it('should not try to re-create an item when there is one already', async () => {
      // TODO
    });
  });
});
