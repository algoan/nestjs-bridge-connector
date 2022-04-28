import { CacheModule, CACHE_MANAGER, HttpModule, HttpService } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { config } from 'node-config-ts';
import { of } from 'rxjs';
import { v4 as uuidV4 } from 'uuid';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { ConfigModule } from '../../../config/config.module';
import {
  mockAuthResponse,
  mockPersonalInformation,
  mockRefreshStatus,
  mockUserResponse,
} from '../../interfaces/bridge-mock';
import {
  BridgeAccount,
  BridgeAccountType,
  BridgeBank,
  BridgeCategory,
  BridgeTransaction,
  ConnectItemResponse,
  ListResponse,
} from '../../interfaces/bridge.interface';
import { BridgeClient } from './bridge.client';

describe('BridgeClient', () => {
  let service: BridgeClient;
  let httpService: HttpService;
  let cacheManager: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register({}), AppModule, HttpModule, AlgoanModule, ConfigModule],
      providers: [BridgeClient],
    }).compile();

    httpService = module.get<HttpService>(HttpService);
    service = module.get<BridgeClient>(BridgeClient);
    cacheManager = module.get<any>(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('can refresh an item', async () => {
    const result: AxiosResponse = {
      data: {},
      status: 202,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    await service.refreshItem('mockItemId', 'secret-access-token');

    expect(spy).toHaveBeenCalledWith('https://api.bridgeapi.io/v2/items/mockItemId/refresh', {
      headers: {
        Authorization: 'Bearer secret-access-token',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can get the status of a refresh of an item', async () => {
    const result: AxiosResponse = {
      data: mockRefreshStatus,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.getRefreshStatus('mockItemId', 'secret-access-token');
    expect(resp).toBe(mockRefreshStatus);

    expect(spy).toHaveBeenCalledWith('https://api.bridgeapi.io/v2/items/mockItemId/refresh/status', {
      headers: {
        Authorization: 'Bearer secret-access-token',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can create a user', async () => {
    const result: AxiosResponse = {
      data: mockUserResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const resp = await service.register({ email: 'mock@email.com', password: 'mockPassword' });
    expect(resp).toBe(mockUserResponse);

    expect(spy).toHaveBeenCalledWith(
      'https://api.bridgeapi.io/v2/users',
      {
        email: 'mock@email.com',
        password: 'mockPassword',
      },
      {
        headers: {
          'Client-Id': config.bridge.clientId,
          'Client-Secret': config.bridge.clientSecret,
          'Bankin-Version': config.bridge.bankinVersion,
        },
      },
    );
  });

  it('can authenticate a user', async () => {
    const result: AxiosResponse = {
      data: mockAuthResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const resp = await service.authenticate({ email: 'mock@email.com', password: 'mockPassword' });
    expect(resp).toBe(mockAuthResponse);

    expect(spy).toHaveBeenCalledWith(
      'https://api.bridgeapi.io/v2/authenticate',
      {
        email: 'mock@email.com',
        password: 'mockPassword',
      },
      {
        headers: {
          'Client-Id': config.bridge.clientId,
          'Client-Secret': config.bridge.clientSecret,
          'Bankin-Version': config.bridge.bankinVersion,
        },
      },
    );
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
    const uuid: string = uuidV4().replace(/-/g, 'z');
    const resp = await service.connectItem('secret-access-token', uuid);
    expect(resp).toBe(connectItemResponse);

    expect(spy).toHaveBeenCalledWith(`https://api.bridgeapi.io/v2/connect/items/add/url?country=fr&context=${uuid}`, {
      headers: {
        Authorization: 'Bearer secret-access-token',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can connect a user to an item with a prefilled_email', async () => {
    const email: string = 'test@test.com';
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
    const uuid: string = uuidV4().replace(/-/g, 'z');
    const resp = await service.connectItem('secret-access-token', uuid, email);
    expect(resp).toBe(connectItemResponse);

    expect(spy).toHaveBeenCalledWith(
      `https://api.bridgeapi.io/v2/connect/items/add/url?country=fr&context=${uuid}&prefill_email=${email}`,
      {
        headers: {
          Authorization: 'Bearer secret-access-token',
          'Client-Id': config.bridge.clientId,
          'Client-Secret': config.bridge.clientSecret,
          'Bankin-Version': config.bridge.bankinVersion,
        },
      },
    );
  });

  it('can get a list of accounts', async () => {
    const listAccountsResponse: ListResponse<BridgeAccount> = {
      resources: [
        {
          id: 2341501,
          resource_uri: '/v2/accounts/2341501',
          resource_type: 'account',
          name: 'Compte Crédit Immobilier',
          balance: -140200,
          status: 0,
          status_code_info: null,
          status_code_description: null,
          updated_at: '2019-04-06T13:53:12Z',
          type: BridgeAccountType.CHECKING,
          currency_code: 'EUR',
          item: {
            id: 187746,
            resource_uri: '/v2/items/187746',
            resource_type: 'item',
          },
          bank: {
            id: 408,
            resource_uri: '/v2/banks/408',
            resource_type: 'bank',
          },
          loan_details: {
            next_payment_date: '2019-04-30',
            next_payment_amount: 1000,
            maturity_date: '2026-12-31',
            opening_date: '2013-01-10',
            interest_rate: 1.25,
            type: 'Prêtimmobilier',
            borrowed_capital: 140200,
            repaid_capital: 40200,
            remaining_capital: 100000,
          },
          savings_details: null,
          is_pro: false,
          iban: 'FR2420020202260600024M02606',
        },
      ],
      pagination: { next_uri: null, previous_uri: null },
    };
    const result: AxiosResponse = {
      data: listAccountsResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.getAccounts('secret-access-token');
    expect(resp).toBe(listAccountsResponse.resources);

    expect(spy).toHaveBeenCalledWith('https://api.bridgeapi.io/v2/accounts', {
      headers: {
        Authorization: 'Bearer secret-access-token',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can get a list of transactions', async () => {
    const listAccountTransactionsResponse: ListResponse<BridgeTransaction> = {
      resources: [
        {
          id: 1000013123932,
          resource_uri: '/v2/transactions/1000013123932',
          resource_type: 'transaction',
          description: 'Prelevement Spotify SA',
          raw_description: 'Prlv 1512 Spotify SA',
          amount: -4.99,
          date: '2019-04-06',
          updated_at: '2019-04-06T09:19:14Z',
          currency_code: 'EUR',
          is_deleted: false,
          category: {
            id: 1,
            resource_uri: '/v2/categories/1',
            resource_type: 'category',
          },
          account: {
            id: 2341498,
            resource_uri: '/v2/accounts/2341498',
            resource_type: 'account',
          },
          is_future: false,
        },
      ],
      pagination: { next_uri: null, previous_uri: null },
    };
    const result: AxiosResponse = {
      data: listAccountTransactionsResponse,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.getTransactions('secret-access-token');
    expect(resp).toEqual(listAccountTransactionsResponse.resources);

    expect(spy).toHaveBeenCalledWith(`https://api.bridgeapi.io/v2/transactions/updated?limit=100`, {
      headers: {
        Authorization: 'Bearer secret-access-token',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can get a resources name by its uri', async () => {
    const mockCategory: BridgeCategory = {
      id: 10,
      resource_uri: '/v2/mockResourceUri',
      resource_type: 'category',
      name: 'mockBankCategory',
    };
    const result: AxiosResponse = {
      data: mockCategory,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.getResourceName('mockAccessToken', mockCategory.resource_uri);
    expect(resp).toBe('mockBankCategory');

    expect(spy).toHaveBeenCalledWith('https://api.bridgeapi.io/v2/mockResourceUri', {
      headers: {
        Authorization: 'Bearer mockAccessToken',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can get a bank information by its uri', async () => {
    const mockBank: BridgeBank = {
      id: 10,
      resource_uri: '/v2/banks/mockResourceUri',
      resource_type: 'bank',
      name: 'mockBankName',
      country_code: 'FR',
      automatic_refresh: false,
      logo_url: 'logo',
    };
    const result: AxiosResponse = {
      data: mockBank,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.getBankInformation('mockAccessToken', mockBank.resource_uri);
    expect(resp).toEqual({ name: 'mockBankName', logoUrl: 'logo' });

    expect(spy).toHaveBeenCalledWith('https://api.bridgeapi.io/v2/banks/mockResourceUri', {
      headers: {
        Authorization: 'Bearer mockAccessToken',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });

  it('can get user information', async () => {
    const result: AxiosResponse = {
      data: mockPersonalInformation,
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const resp = await service.getUserPersonalInformation('mockAccessToken');
    expect(resp).toEqual(mockPersonalInformation);

    expect(spy).toHaveBeenCalledWith('https://api.bridgeapi.io/v2/users/kyc', {
      headers: {
        Authorization: 'Bearer mockAccessToken',
        'Client-Id': config.bridge.clientId,
        'Client-Secret': config.bridge.clientSecret,
        'Bankin-Version': config.bridge.bankinVersion,
      },
    });
  });
});
