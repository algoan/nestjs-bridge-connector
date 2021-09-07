import * as moment from 'moment-timezone';
import { AccountLoanType, AccountType, AccountUsage } from '../../../algoan/dto/analysis.enum';
import { Account, AccountOwner, AccountTransaction } from '../../../algoan/dto/analysis.inputs';
import {
  BridgeAccount,
  BridgeAccountType,
  BridgeTransaction,
  BridgeUserInformation,
} from '../../interfaces/bridge.interface';
import { AggregatorService } from '../aggregator.service';
import { ClientConfig } from './bridge.client';

/**
 * mapBridgeAccount transforms a bridge array of accounts into
 * an array of algoan v2 accounts
 * @param accounts array of accounts from Bridge
 * @param accessToken permanent access token for Bridge api
 */
export const mapBridgeAccount = async (
  accounts: BridgeAccount[],
  userInfo: BridgeUserInformation[],
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<Account[]> =>
  Promise.all(
    accounts.map(async (account) =>
      fromBridgeToAlgoanAccounts(account, userInfo, accessToken, aggregator, clientConfig),
    ),
  );

/**
 * Converts a single Bridge account instance to Algoan format
 * @param account
 * @param accessToken permanent access token for Bridge api
 */
const fromBridgeToAlgoanAccounts = async (
  account: BridgeAccount,
  userInfo: BridgeUserInformation[],
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<Account> => ({
  balance: account.balance,
  balanceDate: new Date(mapDate(account.updated_at)).toISOString(),
  currency: account.currency_code,
  type: mapAccountType(account.type),
  usage: mapUsageType(account.is_pro),
  owners: mapUserInfo(account.item.id, userInfo),
  // eslint-disable-next-line
  iban: account.iban !== null ? account.iban : undefined,
  bic: undefined,
  name: account.name,
  bank: {
    ...(await aggregator.getBankInformation(accessToken, account.bank.resource_uri, clientConfig)),
    id: account.bank?.id?.toString(),
  },
  details: {
    savings: mapAccountType(account.type) === AccountType.SAVINGS ? {} : undefined,
    loan:
      // eslint-disable-next-line
      account.loan_details !== null && account.loan_details !== undefined
        ? {
            amount: account.loan_details.borrowed_capital,
            startDate: new Date(mapDate(account.loan_details.opening_date)).toISOString(),
            endDate: new Date(mapDate(account.loan_details.maturity_date)).toISOString(),
            payment: account.loan_details.next_payment_amount,
            interestRate: account.loan_details.interest_rate,
            remainingCapital: account.loan_details.remaining_capital,
            // ? QUESTION: Mapping of account.loan_details.type to AccountLoanType?
            type: AccountLoanType.OTHER,
          }
        : undefined,
  },
  aggregator: {
    id: account.id.toString(),
  },
});

/**
 * mapDate transforms an iso date in string into a timestamp or undefined
 * @param isoDate date from bridge, if null returns undefined
 */
const mapDate = (isoDate: string): number =>
  isoDate ? moment.tz(isoDate, 'Europe/Paris').toDate().getTime() : moment().toDate().getTime();

/**
 * AccountTypeMapping
 */
interface AccountTypeMapping {
  [index: string]: AccountType;
}

const ACCOUNT_TYPE_MAPPING: AccountTypeMapping = {
  [BridgeAccountType.CHECKING]: AccountType.CHECKING,
  [BridgeAccountType.SAVINGS]: AccountType.SAVINGS,
  [BridgeAccountType.SECURITIES]: AccountType.SAVINGS,
  [BridgeAccountType.CARD]: AccountType.CREDIT_CARD,
  [BridgeAccountType.LOAN]: AccountType.LOAN,
  [BridgeAccountType.SHARE_SAVINGS_PLAN]: AccountType.SAVINGS,
  [BridgeAccountType.LIFE_INSURANCE]: AccountType.SAVINGS,
};

/**
 * mapAccountType map the algoan v2 type from the bridge type
 * @param accountType bridge type
 */
// eslint-disable-next-line no-null/no-null
const mapAccountType = (accountType: BridgeAccountType): AccountType => ACCOUNT_TYPE_MAPPING[accountType] || null;

/**
 * mapUsageType map the algoan v2 usage from the bridge type
 * @param isPro Bridge boolean
 */
const mapUsageType = (isPro: boolean): AccountUsage => (isPro ? AccountUsage.PROFESSIONAL : AccountUsage.PERSONAL);

/**
 * mapUserInfo map the user personal information with the account
 */
const mapUserInfo = (itemId: number, userInfo: BridgeUserInformation[]): AccountOwner[] | undefined => {
  const NOT_FOUND: number = -1;
  const index: number = userInfo.findIndex(({ item_id }): boolean => item_id === itemId);

  return index !== NOT_FOUND
    ? [
        {
          name: [userInfo[index].first_name, userInfo[index].last_name].join(' '),
        },
      ]
    : undefined;
};

/**
 * mapBridgeTransactions transforms a bridge transaction wrapper into
 * an array of algoan v2 transactions
 *
 * @param bridgeTransactions TransactionWrapper from Bridge
 * @param accessToken permanent access token for Bridge api
 */
export const mapBridgeTransactions = async (
  bridgeTransactions: BridgeTransaction[],
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<AccountTransaction[]> =>
  Promise.all(
    bridgeTransactions.map(
      async (transaction: BridgeTransaction): Promise<AccountTransaction> => ({
        dates: {
          debitedAt: !transaction.is_future ? moment.tz(transaction.date, 'Europe/Paris').toISOString() : undefined,
          bookedAt: transaction.is_future ? moment.tz(transaction.date, 'Europe/Paris').toISOString() : undefined,
        },
        description: transaction.raw_description,
        amount: transaction.amount,
        currency: transaction.currency_code,
        isComing: transaction.is_future,
        aggregator: {
          id: transaction.id.toString(),
          category: await aggregator.getResourceName(accessToken, transaction.category.resource_uri, clientConfig),
        },
      }),
    ),
  );
