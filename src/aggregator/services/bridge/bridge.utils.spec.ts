import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/common';
import {
  BanksUserTransactionType,
  AccountType,
  PostBanksUserAccountDTO,
  UsageType,
  PostBanksUserTransactionDTO,
} from '@algoan/rest';
import { BridgeAccount } from '../../interfaces/bridge.interface';
import { AggregatorModule } from '../../aggregator.module';
import { AggregatorService } from '../aggregator.service';
import { mockAccount, mockTransaction } from '../../interfaces/bridge-mock';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { mapBridgeAccount, mapBridgeTransactions } from './bridge.utils';

describe('Bridge Utils', () => {
  let aggregatorService: AggregatorService;
  let aggregatorSpy;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, AlgoanModule, AggregatorModule],
    }).compile();

    aggregatorService = module.get<AggregatorService>(AggregatorService);
    aggregatorSpy = jest
      .spyOn(aggregatorService, 'getResourceName')
      .mockReturnValue(Promise.resolve('mockResourceName'));
  });

  it('should map the bridge account to a banksUser', async () => {
    const expectedAccounts: PostBanksUserAccountDTO[] = [
      {
        balance: 100,
        balanceDate: '2019-04-06T13:53:12.000Z',
        bank: 'mockResourceName',
        bic: undefined,
        connectionSource: 'BRIDGE',
        currency: 'USD',
        iban: 'mockIban',
        loanDetails: {
          amount: 140200,
          endDate: 1798671600000,
          interestRate: 1.25,
          payment: 1000,
          remainingCapital: 100000,
          startDate: 1357772400000,
          type: 'OTHER',
        },
        name: 'mockBridgeAccountName',
        reference: '1234',
        savingsDetails: 'ACTIVE',
        status: 'ACTIVE',
        type: AccountType.CREDIT_CARD,
        usage: UsageType.PERSONAL,
      },
    ];

    const mappedAccount = await mapBridgeAccount([mockAccount], 'mockAccessToken', aggregatorService);

    expect(aggregatorSpy).toHaveBeenCalledWith('mockAccessToken', mockAccount.bank.resource_uri);
    expect(mappedAccount).toEqual(expectedAccounts);
  });

  it('should map the bridge transactions to banksUser', async () => {
    const expectedTransaction: PostBanksUserTransactionDTO[] = [
      {
        amount: 30,
        banksUserCardId: undefined,
        category: 'mockResourceName',
        date: '2019-04-06T13:53:12.000Z',
        description: 'mockRawDescription',
        reference: '23',
        simplifiedDescription: 'mockDescription',
        type: BanksUserTransactionType.UNKNOWN,
        userDescription: 'mockDescription',
      },
    ];

    const mappedTransaction = await mapBridgeTransactions([mockTransaction], 'mockAccessToken', aggregatorService);

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(aggregatorSpy).toBeCalledWith('mockAccessToken', mockTransaction.category.resource_uri);
  });
});
