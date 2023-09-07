import * as moment from 'moment-timezone';
import { AccountLoanType, AccountType, AccountUsage } from '../../../algoan/dto/analysis.enum';
import { Account, AccountOwner, AccountTransaction } from '../../../algoan/dto/analysis.inputs';
import {
  AccountInformation,
  BridgeAccount,
  BridgeAccountType,
  BridgeSimpleAccount,
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
  accountInfo: AccountInformation[],
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<Account[]> =>
  Promise.all(
    accounts.map(async (account) =>
      fromBridgeToAlgoanAccounts(account, userInfo, accountInfo, accessToken, aggregator, clientConfig),
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
  accountInfo: AccountInformation[],
  accessToken: string,
  aggregator: AggregatorService,
  clientConfig?: ClientConfig,
): Promise<Account> => ({
  balance: account.balance,
  balanceDate: new Date(mapDate(account.updated_at)).toISOString(),
  currency: account.currency_code,
  type: mapAccountType(account.type),
  usage: mapUsageType(account.is_pro),
  owners: mapUserInfo(account.item_id, userInfo, accountInfo),
  // eslint-disable-next-line
  iban: account.iban !== null ? account.iban : undefined,
  bic: undefined,
  name: account.name,
  bank: {
    ...(await aggregator.getBankInformation(accessToken, `/v2/banks/${account.bank_id}`, clientConfig)),
    id: account.bank_id?.toString(),
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
            // eslint-disable-next-line no-magic-numbers
            interestRate: mapInterestRate(account.loan_details.interest_rate),
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
  [BridgeAccountType.BROKERAGE]: AccountType.SAVINGS,
  [BridgeAccountType.CARD]: AccountType.CREDIT_CARD,
  [BridgeAccountType.LOAN]: AccountType.LOAN,
  [BridgeAccountType.SHARED_SAVING_PLAN]: AccountType.SAVINGS,
  [BridgeAccountType.LIFE_INSURANCE]: AccountType.SAVINGS,
};

/**
 * mapAccountType map the algoan v2 type from the bridge type
 * @param accountType bridge type
 */
// eslint-disable-next-line no-null/no-null
const mapAccountType = (accountType: BridgeAccountType): AccountType =>
  ACCOUNT_TYPE_MAPPING[accountType] || AccountType.UNKNOWN;

/**
 * mapUsageType map the algoan v2 usage from the bridge type
 * @param isPro Bridge boolean
 */
const mapUsageType = (isPro: boolean): AccountUsage => (isPro ? AccountUsage.PROFESSIONAL : AccountUsage.PERSONAL);

/**
 * mapUserInfo map the user personal information with the account
 */
const mapUserInfo = (
  itemId: number,
  userInfo: BridgeUserInformation[],
  accountInfo: AccountInformation[],
): AccountOwner[] | undefined => {
  const NOT_FOUND: number = -1;
  const indexUser: number = userInfo.findIndex(({ item_id }): boolean => item_id === itemId);
  const indexAccount: number = getAccountIndexInAccountInformation(itemId, accountInfo);

  return indexUser !== NOT_FOUND
    ? [
        {
          name: [userInfo[indexUser].first_name, userInfo[indexUser].last_name].join(' '),
        },
      ]
    : indexAccount !== NOT_FOUND
    ? [
        {
          name: [accountInfo[indexAccount].first_name, accountInfo[indexAccount].last_name].join(' '),
        },
      ]
    : undefined;
};

/**
 * Find the account index in the account array of Account information
 * @param accountItemId the account id
 * @param accountsInformation account information array
 * @returns
 */
export const getAccountIndexInAccountInformation = (
  accountItemId: number,
  accountsInformation: AccountInformation[],
): number => {
  const NOT_FOUND: number = -1;

  for (let i = 0; i < accountsInformation.length; i++) {
    const accountIndex = accountsInformation[i].accounts?.findIndex((account) => account.id === accountItemId);

    if (accountIndex !== NOT_FOUND) {
      return i;
    }
  }

  return NOT_FOUND;
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
  accountType: AccountType,
  clientConfig?: ClientConfig,
): Promise<AccountTransaction[]> =>
  Promise.all(
    bridgeTransactions.map(
      async (transaction: BridgeTransaction): Promise<AccountTransaction> => ({
        dates: {
          debitedAt:
            accountType !== AccountType.CREDIT_CARD
              ? moment.tz(transaction.date, 'Europe/Paris').toISOString()
              : undefined,
          bookedAt:
            accountType === AccountType.CREDIT_CARD
              ? moment.tz(transaction.date, 'Europe/Paris').toISOString()
              : undefined,
        },
        description: transaction.bank_description,
        amount: transaction.amount,
        currency: transaction.currency_code,
        isComing: transaction.is_future,
        aggregator: {
          id: transaction.id.toString(),
          category: await aggregator.getResourceName(
            accessToken,
            `/v2/categories/${transaction.category_id}`,
            clientConfig,
          ),
        },
      }),
    ),
  );

/**
 * Transform the interest rate provided by Bridge to Algoan format
 * @param rate the interest rate in percentage given by Bridge
 * @returns the interest rate in the Algoan format
 */
// eslint-disable-next-line no-magic-numbers
const mapInterestRate = (rate: number): number => parseFloat((rate / 100).toFixed(4));
