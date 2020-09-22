/* eslint-disable max-lines */
import { Test, TestingModule } from '@nestjs/testing';
import {
  Algoan,
  ServiceAccount,
  EventName,
  Subscription,
  RequestBuilder,
  BanksUser,
  BanksUserStatus,
  BanksUserAccount,
  AccountType,
  UsageType,
  MultiResourceCreationResponse,
  BanksUserTransaction,
  BanksUserTransactionType,
  IServiceAccount,
} from '@algoan/rest';
import { EventDTO } from '../dto/event.dto';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AlgoanService } from '../../algoan/algoan.service';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { mockAccount, mockTransaction } from '../../aggregator/interfaces/bridge-mock';
import { mapBridgeAccount, mapBridgeTransactions } from '../../aggregator/services/bridge/bridge.utils';
import { HooksService } from './hooks.service';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
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
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule],
      providers: [HooksService],
    }).compile();

    jest.spyOn(Algoan.prototype, 'initRestHooks').mockResolvedValue();

    hooksService = module.get<HooksService>(HooksService);
    aggregatorService = module.get<AggregatorService>(AggregatorService);
    algoanService = module.get<AlgoanService>(AlgoanService);
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
      jest.spyOn(algoanService.algoanClient, 'getServiceAccountBySubscriptionId').mockReturnValue(mockServiceAccount);
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
    expect(agreggatorSpy).toBeCalledWith(mockBanksUser, mockServiceAccountConfig);
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
    const banksUserAccountSpy = jest.spyOn(mockBanksUser, 'createAccounts').mockResolvedValue([banksUserAccount]);
    const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
    const resourceNameSpy = jest.spyOn(aggregatorService, 'getResourceName').mockResolvedValue('mockResourceName');
    const deleteUserSpy = jest.spyOn(aggregatorService, 'deleteUser').mockResolvedValue();
    const banksUserTransactionSpy = jest
      .spyOn(mockBanksUser, 'createTransactions')
      .mockResolvedValue(banksUserTransactionResponse);
    const banksUserUpdateSpy = jest.spyOn(mockBanksUser, 'update').mockResolvedValue();
    const mappedTransaction = await mapBridgeTransactions([mockTransaction], 'mockPermToken', aggregatorService);
    const mappedAccount = await mapBridgeAccount([mockAccount], 'mockPermToken', aggregatorService);
    await hooksService.handleBankReaderRequiredEvent(mockServiceAccount, mockEvent.payload);

    expect(serviceAccountSpy).toBeCalledWith(mockEvent.payload.banksUserId);
    expect(accessTokenSpy).toBeCalledWith(mockBanksUser, mockServiceAccountConfig);
    expect(accountSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
    expect(resourceNameSpy).toBeCalledWith('mockPermToken', mockAccount.bank.resource_uri, mockServiceAccountConfig);
    expect(banksUserAccountSpy).toBeCalledWith(mappedAccount);
    expect(transactionSpy).toBeCalledWith('mockPermToken', mockServiceAccountConfig);
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
        banksUser: mockBanksUser,
        accessToken: 'mockPermToken',
      },
      mockServiceAccountConfig,
    );
  });
});
