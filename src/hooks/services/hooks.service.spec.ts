/* eslint-disable max-lines */
import {
  EventName,
  IServiceAccount,
  ISubscriptionEvent,
  RequestBuilder,
  ServiceAccount,
  Subscription,
  SubscriptionEvent,
} from '@algoan/rest';
import { ContextIdFactory } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { config } from 'node-config-ts';
import { AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import {
  mockAccount,
  mockAccountInformation,
  mockInvalidAccount,
  mockRefreshStatus,
  mockTransaction,
} from '../../aggregator/interfaces/bridge-mock';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { analysisMock } from '../../algoan/dto/analysis.objects.mock';
import { customerMock } from '../../algoan/dto/customer.objects.mock';
import { AlgoanServiceAcountService } from '../../algoan/services/algoan-service-account.service';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { AppModule } from '../../app.module';
import { CONFIG, ConfigModule } from '../../config/config.module';
import { AggregatorLinkRequiredDTO } from '../dto/aggregator-link-required.dto';
import { EventDTO } from '../dto/event.dto';
import { HooksService } from './hooks.service';
import { BridgeAccount, BridgeAccountType } from '../../aggregator/interfaces/bridge.interface';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
  let algoanHttpService: AlgoanHttpService;
  let algoanCustomerService: AlgoanCustomerService;
  let algoanAnalysisService: AlgoanAnalysisService;
  let algoanServiceAcountService: AlgoanServiceAcountService;

  const mockEvent = {
    subscription: {
      id: 'mockEventSubId',
      target: 'https://bankease.com/algoan-hook/',
      eventName: EventName.AGGREGATOR_LINK_REQUIRED,
      status: 'ACTIVE',
    },
    payload: {
      customerId: '2a0bf32e3180329b3167e777',
    },
    time: 1586177798388,
    index: 32,
    id: 'eventId',
  };
  const mockServiceAccountConfig = {
    clientId: 'mockClientId',
    clientSecret: 'mockClientSecret',
    bankinVersion: 'mockBankinVersion',
    deleteBridgeUsers: false,
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

    jest.spyOn(AlgoanService.prototype, 'initRestHooks').mockResolvedValue();

    hooksService = await moduleRef.resolve<HooksService>(HooksService, contextId);
    aggregatorService = await moduleRef.resolve<AggregatorService>(AggregatorService, contextId);
    algoanService = await moduleRef.resolve<AlgoanService>(AlgoanService, contextId);
    algoanHttpService = await moduleRef.resolve<AlgoanHttpService>(AlgoanHttpService, contextId);
    algoanCustomerService = await moduleRef.resolve<AlgoanCustomerService>(AlgoanCustomerService, contextId);
    algoanAnalysisService = await moduleRef.resolve<AlgoanAnalysisService>(AlgoanAnalysisService, contextId);
    algoanServiceAcountService = await moduleRef.resolve<AlgoanServiceAcountService>(
      AlgoanServiceAcountService,
      contextId,
    );
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
        .mockResolvedValue({} as unknown as ISubscriptionEvent & { id: string });
      jest.spyOn(algoanService.algoanClient, 'getServiceAccountBySubscriptionId').mockReturnValue(mockServiceAccount);
    });

    it('handles aggregator link required', async () => {
      mockEvent.subscription.eventName = EventName.AGGREGATOR_LINK_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleAggregatorLinkRequired').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as unknown as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles bank details required', async () => {
      mockEvent.subscription.eventName = EventName.BANK_DETAILS_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankDetailsRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as unknown as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload, expect.any(Date));
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
      customerMock.personalDetails?.contact?.email,
      mockServiceAccountConfig,
      customerMock.customIdentifier,
    );
    expect(updateCustomerSpy).toBeCalledWith(customerMock.id, {
      aggregationDetails: { aggregatorName: 'BRIDGE', redirectUrl: 'mockRedirectUrl' },
    });
  });

  it('generates an iframe url on aggregator link required', async () => {
    const customerIframeMock = {
      ...customerMock,
      aggregationDetails: { ...customerMock.aggregationDetails, mode: AggregationDetailsMode.IFRAME },
    };
    const mockEventPayload: AggregatorLinkRequiredDTO = { customerId: customerMock.id };
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerIframeMock);
    const updateCustomerSpy = jest.spyOn(algoanCustomerService, 'updateCustomer').mockResolvedValue(customerIframeMock);
    const aggregatorSpy = jest
      .spyOn(aggregatorService, 'generateRedirectUrl')
      .mockReturnValue(Promise.resolve('mockRedirectUrl'));
    mockServiceAccount.config = mockServiceAccountConfig;
    await hooksService.handleAggregatorLinkRequired(mockServiceAccount, mockEventPayload);

    expect(algoanAuthenticateSpy).toBeCalledWith(mockServiceAccount.clientId, mockServiceAccount.clientSecret);
    expect(getCustomerSpy).toBeCalledWith(mockEventPayload.customerId);
    expect(aggregatorSpy).toBeCalledWith(
      customerMock.id,
      customerMock.personalDetails?.contact?.email,
      mockServiceAccountConfig,
      customerMock.customIdentifier,
    );
    expect(updateCustomerSpy).toBeCalledWith(customerMock.id, {
      aggregationDetails: { aggregatorName: 'BRIDGE', iframeUrl: 'mockRedirectUrl' },
    });
  });

  it('synchronizes the accounts on bank details required', async () => {
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerMock);
    const updateAnalysisSpy = jest.spyOn(algoanAnalysisService, 'updateAnalysis').mockResolvedValue(analysisMock);
    mockServiceAccount.config = mockServiceAccountConfig;
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr' },
    });
    const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([
      { ...mockAccount, type: BridgeAccountType.CHECKING },
      { ...mockAccount, id: 0 },
      { ...mockInvalidAccount, id: 1 } as BridgeAccount, // to test the invalid account handling
    ]);
    const userInfoSpy = jest
      .spyOn(aggregatorService, 'getAccountInformation')
      .mockResolvedValue(mockAccountInformation);

    const getTransaction = (dates: { date: string; booking_date?: string; id?: number }) => ({
      ...mockTransaction,
      ...dates,
      account_id: mockAccount.id,
    });

    const date = new Date().toISOString();
    const transactionSpy = jest
      .spyOn(aggregatorService, 'getTransactions')
      .mockResolvedValueOnce([getTransaction({ date, booking_date: date })])
      .mockResolvedValue([getTransaction({ date: '2019-04-06T13:53:12.000Z', booking_date: undefined, id: 1 })]);
    const bankInformationSpy = jest
      .spyOn(aggregatorService, 'getBankInformation')
      .mockResolvedValue({ name: 'mockBankName' });
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();

    const mockEventPayload = {
      customerId: customerMock.id,
      analysisId: analysisMock.id,
      temporaryCode: 'mockTemporaryToken',
    };

    await hooksService.handleBankDetailsRequiredEvent(mockServiceAccount, mockEventPayload, new Date());

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
            name: 'mockBankName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
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
              name: 'JEAN DUPONT',
            },
          ],
          type: 'CHECKING',
          usage: 'PERSONAL',
          transactions: [
            {
              aggregator: {
                category: 'mockResourceName',
                id: '1',
              },
              amount: 30,
              currency: 'USD',
              dates: {
                bookedAt: '2019-04-06T13:53:12.000Z',
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
                bookedAt: date,
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
            name: 'mockBankName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
              payment: 1000,
              remainingCapital: 100000,
              startDate: '2013-01-09T23:00:00.000Z',
              type: 'OTHER',
            },
            savings: undefined,
          },
          iban: 'mockIban',
          name: 'mockBridgeAccountName',
          owners: undefined,
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
        },
      ],
    });

    expect(accessTokenSpy).toBeCalledWith(customerMock.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(userInfoSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(bankInformationSpy).toBeCalledTimes(2);
    expect(resourceNameSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenCalledTimes(0);
  });

  it('synchronizes the accounts on bank details required and exit', async () => {
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerMock);
    const updateAnalysisSpy = jest.spyOn(algoanAnalysisService, 'updateAnalysis').mockResolvedValue(analysisMock);
    mockServiceAccount.config = mockServiceAccountConfig;
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr' },
    });
    const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([
      { ...mockAccount, type: BridgeAccountType.CHECKING },
      { ...mockAccount, id: 0 },
    ]);
    const userInfoSpy = jest
      .spyOn(aggregatorService, 'getAccountInformation')
      .mockResolvedValue(mockAccountInformation);
    const date = new Date().toISOString();
    const transactionSpy = jest
      .spyOn(aggregatorService, 'getTransactions')
      .mockResolvedValueOnce([{ ...mockTransaction, date, account_id: mockAccount.id }])
      .mockResolvedValue([]);
    const bankInformationSpy = jest
      .spyOn(aggregatorService, 'getBankInformation')
      .mockResolvedValue({ name: 'mockBankName' });
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();

    const mockEventPayload = {
      customerId: customerMock.id,
      analysisId: analysisMock.id,
      temporaryCode: 'mockTemporaryToken',
    };

    await hooksService.handleBankDetailsRequiredEvent(mockServiceAccount, mockEventPayload, new Date());

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
            name: 'mockBankName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
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
              name: 'JEAN DUPONT',
            },
          ],
          type: 'CHECKING',
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
                bookedAt: '2019-04-06T13:53:12.000Z',
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
            name: 'mockBankName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
              payment: 1000,
              remainingCapital: 100000,
              startDate: '2013-01-09T23:00:00.000Z',
              type: 'OTHER',
            },
            savings: undefined,
          },
          iban: 'mockIban',
          name: 'mockBridgeAccountName',
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
        },
      ],
    });

    expect(accessTokenSpy).toBeCalledWith(customerMock.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(userInfoSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(bankInformationSpy).toBeCalledTimes(2);
    expect(resourceNameSpy).toBeCalledTimes(1);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenCalledTimes(0);
  });

  it('Patch analysis with an algoan error on bank details required and exit', async () => {
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerMock);
    const updateAnalysisSpy = jest
      .spyOn(algoanAnalysisService, 'updateAnalysis')
      .mockRejectedValueOnce({
        request: {
          host: 'api.algoan.com',
        },
      })
      .mockResolvedValue(analysisMock);
    mockServiceAccount.config = mockServiceAccountConfig;
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr' },
    });
    const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([
      { ...mockAccount, type: BridgeAccountType.CHECKING },
      { ...mockAccount, id: 0 },
    ]);
    const userInfoSpy = jest
      .spyOn(aggregatorService, 'getAccountInformation')
      .mockResolvedValue(mockAccountInformation);
    const date = new Date().toISOString();
    const transactionSpy = jest
      .spyOn(aggregatorService, 'getTransactions')
      .mockResolvedValueOnce([{ ...mockTransaction, date, account_id: mockAccount.id }])
      .mockResolvedValue([]);
    const bankInformationSpy = jest
      .spyOn(aggregatorService, 'getBankInformation')
      .mockResolvedValue({ name: 'mockBankName' });
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();

    const mockEventPayload = {
      customerId: customerMock.id,
      analysisId: analysisMock.id,
      temporaryCode: 'mockTemporaryToken',
    };

    try {
      await hooksService.handleBankDetailsRequiredEvent(mockServiceAccount, mockEventPayload, new Date());
    } catch (err) {
      expect(err).toEqual({ request: { host: 'api.algoan.com' } });
    }

    expect(algoanAuthenticateSpy).toBeCalledWith(mockServiceAccount.clientId, mockServiceAccount.clientSecret);
    expect(getCustomerSpy).toBeCalledWith(mockEventPayload.customerId);
    expect(accessTokenSpy).toBeCalledWith(customerMock.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(userInfoSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(bankInformationSpy).toBeCalledTimes(2);
    expect(resourceNameSpy).toBeCalledTimes(1);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenCalledTimes(0);
    expect(updateAnalysisSpy).toHaveBeenCalledTimes(2);
    expect(updateAnalysisSpy).toHaveBeenCalledWith(customerMock.id, mockEventPayload.analysisId, {
      accounts: [
        {
          aggregator: {
            id: '1234',
          },
          balance: 100,
          balanceDate: '2019-04-06T13:53:12.000Z',
          bank: {
            id: '6',
            name: 'mockBankName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
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
              name: 'JEAN DUPONT',
            },
          ],
          type: 'CHECKING',
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
                bookedAt: '2019-04-06T13:53:12.000Z',
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
            name: 'mockBankName',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
              payment: 1000,
              remainingCapital: 100000,
              startDate: '2013-01-09T23:00:00.000Z',
              type: 'OTHER',
            },
            savings: undefined,
          },
          iban: 'mockIban',
          name: 'mockBridgeAccountName',
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
        },
      ],
    });
    expect(updateAnalysisSpy).toBeCalledWith(customerMock.id, mockEventPayload.analysisId, {
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred while calling Algoan APIs' },
      status: 'ERROR',
    });
  });

  it('Patch analysis with an aggregator error on bank details required and exit ', async () => {
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue(customerMock);
    const updateAnalysisSpy = jest.spyOn(algoanAnalysisService, 'updateAnalysis').mockResolvedValue(analysisMock);
    mockServiceAccount.config = mockServiceAccountConfig;
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr' },
    });
    const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockRejectedValue({
      request: {
        host: 'api.bridge.com',
      },
    });

    const mockEventPayload = {
      customerId: customerMock.id,
      analysisId: analysisMock.id,
      temporaryCode: 'mockTemporaryToken',
    };

    try {
      await hooksService.handleBankDetailsRequiredEvent(mockServiceAccount, mockEventPayload, new Date());
    } catch (err) {
      expect(err).toEqual({ request: { host: 'api.bridge.com' } });
    }

    expect(algoanAuthenticateSpy).toBeCalledWith(mockServiceAccount.clientId, mockServiceAccount.clientSecret);
    expect(getCustomerSpy).toBeCalledWith(mockEventPayload.customerId);
    expect(accessTokenSpy).toBeCalledWith(customerMock.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(updateAnalysisSpy).toHaveBeenCalledTimes(1);
    expect(updateAnalysisSpy).toBeCalledWith(customerMock.id, mockEventPayload.analysisId, {
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred while fetching data from the aggregator' },
      status: 'ERROR',
    });
  });

  it('refresh when userId is defined and synchronizes the accounts on bank details required', async () => {
    const algoanAuthenticateSpy = jest.spyOn(algoanHttpService, 'authenticate').mockReturnValue();
    const getCustomerSpy = jest.spyOn(algoanCustomerService, 'getCustomerById').mockResolvedValue({
      ...customerMock,
      aggregationDetails: {
        ...customerMock,
        userId: 'mockItemId',
      },
    });
    const updateAnalysisSpy = jest.spyOn(algoanAnalysisService, 'updateAnalysis').mockResolvedValue(analysisMock);
    mockServiceAccount.config = mockServiceAccountConfig;
    const accessTokenSpy = jest.spyOn(aggregatorService, 'getAccessToken').mockResolvedValue({
      access_token: 'mockPermToken',
      expires_at: '323423423423',
      user: { email: 'test@test.com', uuid: 'rrr' },
    });
    const refreshSpy = jest.spyOn(aggregatorService, 'refresh').mockResolvedValue();
    const refreshStatusSpy = jest
      .spyOn(aggregatorService, 'getRefreshStatus')
      .mockResolvedValueOnce({ ...mockRefreshStatus, status: 'in progress' })
      .mockResolvedValue(mockRefreshStatus);
    const accountSpy = jest
      .spyOn(aggregatorService, 'getAccounts')
      .mockResolvedValue([mockAccount, { ...mockAccount, id: 0 }]);
    const userInfoSpy = jest
      .spyOn(aggregatorService, 'getAccountInformation')
      .mockResolvedValue(mockAccountInformation);
    const date = new Date().toISOString();
    const transactionSpy = jest
      .spyOn(aggregatorService, 'getTransactions')
      .mockResolvedValueOnce([{ ...mockTransaction, date, account_id: mockAccount.id }])
      .mockResolvedValue([{ ...mockTransaction, account_id: mockAccount.id, id: 1 }]);
    const bankInformationSpy = jest
      .spyOn(aggregatorService, 'getBankInformation')
      .mockResolvedValue({ name: 'mockBankName', logoUrl: 'logo' });
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();

    const mockEventPayload = {
      customerId: customerMock.id,
      analysisId: analysisMock.id,
      temporaryCode: 'mockTemporaryToken',
    };

    await hooksService.handleBankDetailsRequiredEvent(mockServiceAccount, mockEventPayload, new Date());
    expect(algoanAuthenticateSpy).toBeCalledWith(mockServiceAccount.clientId, mockServiceAccount.clientSecret);
    expect(getCustomerSpy).toBeCalledWith(mockEventPayload.customerId);
    expect(refreshSpy).toBeCalledWith('mockItemId', 'mockPermToken', mockServiceAccountConfig);
    expect(refreshStatusSpy).toBeCalledTimes(2);
    expect(refreshStatusSpy).toBeCalledWith('mockItemId', 'mockPermToken', mockServiceAccountConfig);
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
            name: 'mockBankName',
            logoUrl: 'logo',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
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
              name: 'JEAN DUPONT',
            },
          ],
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
          transactions: [
            {
              aggregator: {
                category: 'mockResourceName',
                id: '1',
              },
              amount: 30,
              currency: 'USD',
              dates: {
                debitedAt: '2019-04-06T13:53:12.000Z',
                bookedAt: '2019-04-06T13:53:12.000Z',
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
                bookedAt: '2019-04-06T13:53:12.000Z',
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
            name: 'mockBankName',
            logoUrl: 'logo',
          },
          bic: undefined,
          currency: 'USD',
          details: {
            loan: {
              amount: 140200,
              endDate: '2026-12-30T23:00:00.000Z',
              interestRate: 0.0125,
              payment: 1000,
              remainingCapital: 100000,
              startDate: '2013-01-09T23:00:00.000Z',
              type: 'OTHER',
            },
            savings: undefined,
          },
          iban: 'mockIban',
          name: 'mockBridgeAccountName',
          type: 'CREDIT_CARD',
          usage: 'PERSONAL',
        },
      ],
    });

    expect(accessTokenSpy).toBeCalledWith(customerMock.id, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(userInfoSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(bankInformationSpy).toBeCalledTimes(2);
    expect(resourceNameSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenCalledTimes(0);
  });

  describe('Func handleServiceAccountUpdatedEvent()', () => {
    it('should update service account config', async () => {
      const findServiceAccountSpy = jest.spyOn(algoanServiceAcountService, 'findById').mockResolvedValue({
        clientId: 'clientId',
        config: {
          test: true,
        },
      } as ServiceAccount);

      await hooksService.handleServiceAccountUpdatedEvent({
        serviceAccountId: 'id',
      });

      expect(findServiceAccountSpy).toBeCalled();
    });
  });

  describe('Func handleServiceAccountCreatedEvent()', () => {
    it('should update service account list and create subscriptions', async () => {
      const findServiceAccountSpy = jest.spyOn(algoanServiceAcountService, 'findById').mockResolvedValue(
        new ServiceAccount('url', {
          id: 'id',
          clientId: 'clientId',
          clientSecret: 'secret',
          createdAt: new Date().toISOString(),
        }),
      );

      const getOrCreateSubscriptionsSpy = jest
        .spyOn(ServiceAccount.prototype, 'getOrCreateSubscriptions')
        .mockResolvedValue([]);

      await hooksService.handleServiceAccountCreatedEvent({
        serviceAccountId: 'id',
      });

      expect(findServiceAccountSpy).toBeCalled();
      expect(getOrCreateSubscriptionsSpy).toBeCalledWith(
        [{ eventName: 'service_account_created', secret: 'a', target: 'http://localhost:8080/hooks' }],
        ['service_account_created'],
      );
    });
  });
});
