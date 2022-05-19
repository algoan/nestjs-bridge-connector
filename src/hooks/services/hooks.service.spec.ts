/* eslint-disable max-lines */
import {
  Algoan,
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
  mockPersonalInformation,
  mockRefreshStatus,
  mockTransaction,
} from '../../aggregator/interfaces/bridge-mock';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { analysisMock } from '../../algoan/dto/analysis.objects.mock';
import { customerMock } from '../../algoan/dto/customer.objects.mock';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { AppModule } from '../../app.module';
import { CONFIG, ConfigModule } from '../../config/config.module';
import { AggregatorLinkRequiredDTO } from '../dto/aggregator-link-required.dto';
import { EventDTO } from '../dto/event.dto';
import { HooksService } from './hooks.service';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
  let algoanHttpService: AlgoanHttpService;
  let algoanCustomerService: AlgoanCustomerService;
  let algoanAnalysisService: AlgoanAnalysisService;

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

    jest.spyOn(Algoan.prototype, 'initRestHooks').mockResolvedValue();

    hooksService = await moduleRef.resolve<HooksService>(HooksService, contextId);
    aggregatorService = await moduleRef.resolve<AggregatorService>(AggregatorService, contextId);
    algoanService = await moduleRef.resolve<AlgoanService>(AlgoanService, contextId);
    algoanHttpService = await moduleRef.resolve<AlgoanHttpService>(AlgoanHttpService, contextId);
    algoanCustomerService = await moduleRef.resolve<AlgoanCustomerService>(AlgoanCustomerService, contextId);
    algoanAnalysisService = await moduleRef.resolve<AlgoanAnalysisService>(AlgoanAnalysisService, contextId);
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
      customerMock.aggregationDetails?.callbackUrl,
      customerMock.personalDetails?.contact?.email,
      mockServiceAccountConfig,
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
      customerMock.aggregationDetails?.callbackUrl,
      customerMock.personalDetails?.contact?.email,
      mockServiceAccountConfig,
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
    expect(bankInformationSpy).toBeCalledTimes(2);
    expect(resourceNameSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenCalledTimes(0);
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
      user: { email: 'test@test.com', uuid: 'rrr', resource_type: 's', resource_uri: '/..' },
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
      .spyOn(aggregatorService, 'getUserPersonalInformation')
      .mockResolvedValue(mockPersonalInformation);
    const date = new Date().toISOString();
    const transactionSpy = jest
      .spyOn(aggregatorService, 'getTransactions')
      .mockResolvedValueOnce([
        { ...mockTransaction, date, account: { ...mockTransaction.account, id: mockAccount.id } },
      ])
      .mockResolvedValue([{ ...mockTransaction, account: { ...mockTransaction.account, id: mockAccount.id } }]);
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
    expect(bankInformationSpy).toBeCalledTimes(2);
    expect(resourceNameSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledTimes(2);
    expect(transactionSpy).toBeCalledWith('mockPermToken', undefined, mockServiceAccountConfig);
    expect(deleteUserSpy).toHaveBeenCalledTimes(0);
  });
});
