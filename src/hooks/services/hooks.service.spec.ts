/* eslint-disable max-lines */
import {
  AccountType,
  Algoan,
  BanksUser,
  BanksUserAccount,
  BanksUserStatus,
  BanksUserTransaction,
  BanksUserTransactionType,
  EventName,
  IServiceAccount,
  ISubscriptionEvent,
  MultiResourceCreationResponse,
  RequestBuilder,
  ServiceAccount,
  Subscription,
  SubscriptionEvent,
  UsageType,
} from '@algoan/rest';
import { ContextIdFactory } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { config } from 'node-config-ts';

import { AggregatorModule } from '../../aggregator/aggregator.module';
import { mockAccount, mockPersonalInformation, mockTransaction } from '../../aggregator/interfaces/bridge-mock';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { mapBridgeAccount, mapBridgeTransactions } from '../../aggregator/services/bridge/bridge.utils';
import { AlgoanModule } from '../../algoan/algoan.module';
import { analysisMock } from '../../algoan/dto/analysis.objects.mock';
import { customerMock } from '../../algoan/dto/customer.objects.mock';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { AppModule } from '../../app.module';
import { CONFIG } from '../../config/config.module';
import { ConfigModule } from '../../config/config.module';
import { AggregatorLinkRequiredDTO } from '../dto/aggregator-link-required.dto';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { EventDTO } from '../dto/event.dto';
import { HooksService } from './hooks.service';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
  let algoanHttpService: AlgoanHttpService;
  let algoanCustomerService: AlgoanCustomerService;
  let algoanAnalysisService: AlgoanAnalysisService;
  let serviceAccount: ServiceAccount;

  const mockEvent = {
    subscription: {
      id: 'mockEventSubId',
      target: 'https://bankease.com/algoan-hook/',
      eventName: EventName.BANKREADER_REQUIRED,
      status: 'ACTIVE',
    },
    payload: {
      banksUserId: '2a0bf32e3180329b3167e777',
      temporaryCode: 'mockTempCode',
      applicationId: 'mockApplicationId',
    },
    time: 1586177798388,
    index: 32,
    id: 'eventId',
  };
  const mockServiceAccountConfig = {
    clientId: 'mockClientId',
    clientSecret: 'mockClientSecret',
    bankinVersion: 'mockBankinVersion',
  };

  const mockServiceAccount: ServiceAccount = new ServiceAccount('mockBaseURL', {
    id: 'mockServiceAccountId',
    clientId: 'mockClientId',
    clientSecret: 'mockClientSecret',
    createdAt: 'mockCreatedAt',
    config: mockServiceAccountConfig,
  } as IServiceAccount);

  mockServiceAccount.subscriptions = [
    new Subscription(
      { id: 'mockEventSubId', eventName: EventName.BANKREADER_COMPLETED, status: 'ACTIVE', target: 'mockSubTarget' },
      new RequestBuilder('mockBaseURL', { clientId: 'mockClientId' }),
    ),
  ];

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

  beforeEach(async () => {
    // To mock scoped DI
    const contextId = ContextIdFactory.create();
    jest.spyOn(ContextIdFactory, 'getByRequest').mockImplementation(() => contextId);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AlgoanModule, AggregatorModule, ConfigModule],
      providers: [
        HooksService,
        {
          provide: CONFIG,
          useValue: config,
        },
        {
          provide: ServiceAccount,
          useValue: mockServiceAccount,
        },
      ],
    }).compile();

    jest.spyOn(Algoan.prototype, 'initRestHooks').mockResolvedValue();

    hooksService = await moduleRef.resolve<HooksService>(HooksService, contextId);
    aggregatorService = await moduleRef.resolve<AggregatorService>(AggregatorService, contextId);
    algoanService = await moduleRef.resolve<AlgoanService>(AlgoanService, contextId);
    algoanHttpService = await moduleRef.resolve<AlgoanHttpService>(AlgoanHttpService, contextId);
    algoanCustomerService = await moduleRef.resolve<AlgoanCustomerService>(AlgoanCustomerService, contextId);
    algoanAnalysisService = await moduleRef.resolve<AlgoanAnalysisService>(AlgoanAnalysisService, contextId);
    serviceAccount = await moduleRef.resolve<ServiceAccount>(ServiceAccount, contextId);
    await algoanService.onModuleInit();
  });

  afterEach(() => {
    /** Reset all spies and mocks */
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(hooksService).toBeDefined();
  });

  describe('handleWebhook calls the correct event handling function', () => {
    beforeEach(() => {
      jest
        .spyOn(SubscriptionEvent.prototype, 'update')
        .mockResolvedValue(({} as unknown) as ISubscriptionEvent & { id: string });
      jest.spyOn(algoanService.algoanClient, 'getServiceAccountBySubscriptionId').mockReturnValue(mockServiceAccount);
    });

    it('handles aggregator link required', async () => {
      mockEvent.subscription.eventName = EventName.AGGREGATOR_LINK_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleAggregatorLinkRequired').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles bank details required', async () => {
      mockEvent.subscription.eventName = EventName.BANK_DETAILS_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankDetailsRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles bankreader link required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_LINK_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankreaderLinkRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles bankreader required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankReaderRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });
  });

  it('generates a redirect url on aggregator link required', async () => {
    const mockEventPayload: AggregatorLinkRequiredDTO = { customerId: customerMock.id };
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerMock);
    const updateCustomerSpy = jest.spyOn(algoanCustomerService, 'updateCustomer').mockResolvedValue(customerMock);
    const aggregatorSpy = jest
      .spyOn(aggregatorService, 'generateRedirectUrl')
      .mockReturnValue(Promise.resolve('mockRedirectUrl'));
    mockServiceAccount.config = mockServiceAccountConfig;
    await hooksService.handleAggregatorLinkRequired(mockServiceAccount, mockEventPayload);

    expect(algoanAuthenticateSpy).toBeCalledWith(mockServiceAccount.clientId, mockServiceAccount.clientSecret);
    expect(getCustomerSpy).toBeCalledWith(mockEventPayload.customerId);
    expect(aggregatorSpy).toBeCalledWith(
      customerMock.id,
      customerMock.aggregationDetails?.callbackUrl,
      customerMock.personalDetails?.contact?.email,
      mockServiceAccountConfig,
    );
    expect(updateCustomerSpy).toBeCalledWith(customerMock.id, {
      aggregationDetails: { aggregatorName: 'BRIDGE', redirectUrl: 'mockRedirectUrl' },
    });
  });

  it('generates a redirect url on bankreader link required', async () => {
    const serviceAccountSpy = jest
      .spyOn(mockServiceAccount, 'getBanksUserById')
      .mockReturnValue(Promise.resolve(mockBanksUser));
    const agreggatorSpy = jest
      .spyOn(aggregatorService, 'generateRedirectUrl')
      .mockReturnValue(Promise.resolve('mockRedirectUrl'));
    const banksUserSpy = jest.spyOn(mockBanksUser, 'update').mockResolvedValue();
    mockServiceAccount.config = mockServiceAccountConfig;
    await hooksService.handleBankreaderLinkRequiredEvent(
      mockServiceAccount,
      mockEvent.payload as BankreaderLinkRequiredDTO,
    );

    expect(serviceAccountSpy).toBeCalledWith(mockEvent.payload.banksUserId);
    expect(agreggatorSpy).toBeCalledWith(
      mockBanksUser.id,
      mockBanksUser.callbackUrl,
      undefined,
      mockServiceAccountConfig,
    );
    expect(banksUserSpy).toBeCalledWith({ redirectUrl: 'mockRedirectUrl' });
  });

  it('synchronizes the acccounts on bank reader required', async () => {
    const banksUserAccount: BanksUserAccount = {
      id: 'accountId1',
      balance: 100,
      balanceDate: '23/06/2020',
      connectionSource: 'mockConnectionSource',
      currency: 'EUR',
      type: AccountType.SAVINGS,
      usage: UsageType.PERSONAL,
      reference: '56',
    };
    const banksUserTransactionResponse: MultiResourceCreationResponse<BanksUserTransaction> = {
      elements: [
        {
          resource: {
            id: 'transactionId1',
            amount: 50,
            category: 'mockCategory',
            date: '23/06/2020',
            description: 'mockDescription',
            type: BanksUserTransactionType.ATM,
          },
          status: 200,
        },
      ],
      metadata: { failure: 0, success: 1, total: 1 },
    };

    const serviceAccountSpy = jest
      .spyOn(mockServiceAccount, 'getBanksUserById')
      .mockReturnValue(Promise.resolve(mockBanksUser));
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr', resource_type: 's', resource_uri: '/..' },
    });
    const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([mockAccount]);
    const userInfoSpy = jest
      .spyOn(aggregatorService, 'getUserPersonalInformation')
      .mockResolvedValue(mockPersonalInformation);
    const banksUserAccountSpy = jest.spyOn(mockBanksUser, 'createAccounts').mockResolvedValue([banksUserAccount]);
    const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();
    const banksUserTransactionSpy = jest
      .spyOn(mockBanksUser, 'createTransactions')
      .mockResolvedValue(banksUserTransactionResponse);
    const banksUserUpdateSpy = jest.spyOn(mockBanksUser, 'update').mockResolvedValue();
    const mappedTransaction = await mapBridgeTransactions([mockTransaction], 'mockPermToken', aggregatorService);
    const mappedAccount = await mapBridgeAccount(
      [mockAccount],
      mockPersonalInformation,
      'mockPermToken',
      aggregatorService,
    );
    await hooksService.handleBankReaderRequiredEvent(mockServiceAccount, mockEvent.payload);

    expect(serviceAccountSpy).toBeCalledWith(mockEvent.payload.banksUserId);
    expect(accessTokenSpy).toBeCalledWith(mockBanksUser.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(userInfoSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(resourceNameSpy).toBeCalledWith('mockPermToken', mockAccount.bank.resource_uri, mockServiceAccountConfig);
    expect(banksUserAccountSpy).toBeCalledWith(mappedAccount);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(resourceNameSpy).toBeCalledWith(
      'mockPermToken',
      mockTransaction.category.resource_uri,
      mockServiceAccountConfig,
    );
    expect(banksUserTransactionSpy).toBeCalledWith(banksUserAccount.id, mappedTransaction);
    expect(banksUserUpdateSpy).toBeCalledTimes(3);
    expect(banksUserUpdateSpy).toHaveBeenNthCalledWith(1, {
      status: BanksUserStatus.SYNCHRONIZING,
    });
    expect(banksUserUpdateSpy).toHaveBeenNthCalledWith(2, {
      status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
    });
    expect(banksUserUpdateSpy).toHaveBeenNthCalledWith(3, {
      status: BanksUserStatus.FINISHED,
    });
    expect(deleteUserSpy).toHaveBeenNthCalledWith(
      1,
      {
        bridgeUserId: 'rrr',
        id: mockBanksUser.id,
        accessToken: 'mockPermToken',
      },
      mockServiceAccountConfig,
    );
  });

  it('synchronizes the accounts on bank details required', async () => {
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerMock);
    const updateAnalysisSpy = jest.spyOn(algoanAnalysisService, 'updateAnalysis').mockResolvedValue(analysisMock);
    mockServiceAccount.config = mockServiceAccountConfig;
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr', resource_type: 's', resource_uri: '/..' },
    });
    const accountSpy = jest
      .spyOn(aggregatorService, 'getAccounts')
      .mockResolvedValue([mockAccount, { ...mockAccount, id: 0 }]);
    const userInfoSpy = jest
      .spyOn(aggregatorService, 'getUserPersonalInformation')
      .mockResolvedValue(mockPersonalInformation);
    const date = new Date().toISOString();
    const transactionSpy = jest
      .spyOn(aggregatorService, 'getTransactions')
      .mockResolvedValueOnce([
        { ...mockTransaction, date, account: { ...mockTransaction.account, id: mockAccount.id } },
      ])
      .mockResolvedValue([{ ...mockTransaction, account: { ...mockTransaction.account, id: mockAccount.id } }]);
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();

    const mockEventPayload = {
      customerId: customerMock.id,
      analysisId: analysisMock.id,
      temporaryCode: 'mockTemporaryToken',
    };

    await hooksService.handleBankDetailsRequiredEvent(mockServiceAccount, mockEventPayload);

    expect(algoanAuthenticateSpy).toBeCalledWith(mockServiceAccount.clientId, mockServiceAccount.clientSecret);
    expect(getCustomerSpy).toBeCalledWith(mockEventPayload.customerId);
    expect(updateAnalysisSpy).toBeCalledWith(customerMock.id, mockEventPayload.analysisId, {
      accounts: [
        {
          aggregator: {
            id: '1234',
          },
          balance: 100,
          balanceDate: '2019-04-06T13:53:12.000Z',
          bank: {
            id: '6',
            name: 'mockResourceName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 1.25,
              payment: 1000,
              remainingCapital: 100000,
              startDate: '2013-01-09T23:00:00.000Z',
              type: 'OTHER',
            },
            savings: undefined,
          },
          iban: 'mockIban',
          name: 'mockBridgeAccountName',
          owners: [
            {
              name: ' DUPONT',
            },
          ],
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
          transactions: [
            {
              aggregator: {
                category: 'mockResourceName',
                id: '23',
              },
              amount: 30,
              currency: 'USD',
              dates: {
                bookedAt: undefined,
                debitedAt: '2019-04-06T13:53:12.000Z',
              },
              description: 'mockRawDescription',
              isComing: false,
            },
            {
              aggregator: {
                category: 'mockResourceName',
                id: '23',
              },
              amount: 30,
              currency: 'USD',
              dates: {
                bookedAt: undefined,
                debitedAt: date,
              },
              description: 'mockRawDescription',
              isComing: false,
            },
          ],
        },
        {
          aggregator: {
            id: '0',
          },
          balance: 100,
          balanceDate: '2019-04-06T13:53:12.000Z',
          bank: {
            id: '6',
            name: 'mockResourceName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 1.25,
              payment: 1000,
              remainingCapital: 100000,
              startDate: '2013-01-09T23:00:00.000Z',
              type: 'OTHER',
            },
            savings: undefined,
          },
          iban: 'mockIban',
          name: 'mockBridgeAccountName',
          owners: [
            {
              name: ' DUPONT',
            },
          ],
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
        },
      ],
    });

    expect(accessTokenSpy).toBeCalledWith(customerMock.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(userInfoSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(resourceNameSpy).toBeCalledTimes(4);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenNthCalledWith(
      1,
      {
        bridgeUserId: 'rrr',
        id: customerMock.id,
        accessToken: 'mockPermToken',
      },
      mockServiceAccountConfig,
    );
  });
});
