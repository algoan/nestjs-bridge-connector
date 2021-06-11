import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AlgoanModule } from '../../../algoan/algoan.module';
import { AccountLoanType, AccountType, AccountUsage } from '../../../algoan/dto/analysis.enum';
import { Account, AccountTransaction } from '../../../algoan/dto/analysis.inputs';
import { AppModule } from '../../../app.module';
import { AggregatorModule } from '../../aggregator.module';
import { mockAccount, mockPersonalInformation, mockTransaction } from '../../interfaces/bridge-mock';
import { AggregatorService } from '../aggregator.service';
import { mapBridgeAccount, mapBridgeTransactions } from './bridge-v2.utils';

describe('Bridge Utils for Algoan v2 (Customer, Analysis)', () => {
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

  it("should map the bridge account to algoan customer's account", async () => {
    const expectedAccounts: Account[] = [
      {
        balance: 100,
        balanceDate: '2019-04-06T13:53:12.000Z',
        currency: 'USD',
        type: AccountType.CREDIT_CARD,
        usage: AccountUsage.PERSONAL,
        owners: [{ name: ' DUPONT' }],
        iban: 'mockIban',
        name: 'mockBridgeAccountName',
        bank: { id: '6', name: 'mockResourceName' },
        details: {
          loan: {
            amount: 140200,
            startDate: '2013-01-09T23:00:00.000Z',
            endDate: '2026-12-30T23:00:00.000Z',
            payment: 1000,
            interestRate: 1.25,
            remainingCapital: 100000,
            type: AccountLoanType.OTHER,
          },
        },
        aggregator: { id: '1234' },
      },
    ];

    const mappedAccount = await mapBridgeAccount(
      [mockAccount],
      mockPersonalInformation,
      'mockAccessToken',
      aggregatorService,
    );

    expect(aggregatorSpy).toHaveBeenCalledWith('mockAccessToken', mockAccount.bank.resource_uri, undefined);
    expect(mappedAccount).toEqual(expectedAccounts);
  });

  it("should map the bridge transactions to algoan customer's transactions", async () => {
    const expectedTransaction: AccountTransaction[] = [
      {
        dates: { debitedAt: '2019-04-06T13:53:12.000Z' },
        description: 'mockRawDescription',
        amount: 30,
        currency: 'USD',
        isComing: false,
        aggregator: { id: '23', category: 'mockResourceName' },
      },
    ];

    const mappedTransaction = await mapBridgeTransactions([mockTransaction], 'mockAccessToken', aggregatorService);

    expect(mappedTransaction).toEqual(expectedTransaction);
    expect(aggregatorSpy).toBeCalledWith('mockAccessToken', mockTransaction.category.resource_uri, undefined);
  });
});
