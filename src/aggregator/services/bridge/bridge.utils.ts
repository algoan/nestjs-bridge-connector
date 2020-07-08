import * as moment from 'moment-timezone';
import {
  PostBanksUserTransactionDTO,
  BanksUserTransactionType as TransactionType,
  UsageType,
  AccountType,
  PostBanksUserAccountDTO,
  BanksUserTransactionType,
} from '@algoan/rest';

import {
  BridgeAccount,
  BridgeAccountType,
  BridgeAccountStatus,
  BridgeTransaction,
} from '../../interfaces/bridge.interface';

/**
 * mapBridgeAccount transforms a bridge array of acccounts into
 * an array of Banks User accounts
 * @param accounts array of accounts from Bridge
 */
export const mapBridgeAccount = (accounts: BridgeAccount[]): PostBanksUserAccountDTO[] =>
  accounts.map(fromBridgeToAlgoanAccounts);

/**
 * Converts a single Bridge account instance to Algoan format
 * @param account
 */
const fromBridgeToAlgoanAccounts = (account: BridgeAccount): PostBanksUserAccountDTO => ({
  balanceDate: new Date(mapDate(account.updated_at)).toISOString(),
  balance: account.balance,
  bank: account.name, // @TODO get bank name from Bridge Bank api
  connectionSource: 'BRIDGE',
  type: mapAccountType(account.type),
  bic: undefined,
  iban: account.iban,
  currency: account.currency_code,
  name: account.name,
  reference: account.id.toString(),
  status: mapAccountStatus(account.status),
  usage: mapUsageType(account.is_pro),
  loanDetails:
    // eslint-disable-next-line no-null/no-null
    account.loan_details !== null
      ? {
          amount: account.loan_details.borrowed_capital,
          startDate: mapDate(account.loan_details.opening_date),
          endDate: mapDate(account.loan_details.maturity_date),
          payment: account.loan_details.next_payment_amount,
          interestRate: account.loan_details.interest_rate,
          remainingCapital: account.loan_details.remaining_capital,
          type: 'OTHER',
        }
      : undefined,
  savingsDetails: mapAccountStatus(account.status),
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
  [BridgeAccountType.CHECKING]: AccountType.CHECKINGS,
  [BridgeAccountType.SAVINGS]: AccountType.SAVINGS,
  [BridgeAccountType.SECURITIES]: AccountType.SAVINGS,
  [BridgeAccountType.CARD]: AccountType.CREDIT_CARD,
  [BridgeAccountType.LOAN]: AccountType.LOAN,
  [BridgeAccountType.SHARE_SAVINGS_PLAN]: AccountType.SAVINGS,
  [BridgeAccountType.LIFE_INSURANCE]: AccountType.SAVINGS,
};

/**
 * mapAccountType map the banksUser type from the bridge type
 * @param accountType bridge type
 */
// eslint-disable-next-line no-null/no-null
const mapAccountType = (accountType: BridgeAccountType): AccountType => ACCOUNT_TYPE_MAPPING[accountType] || null;

/**
 * AccountStatusMapping
 */
interface AccountStatusMapping {
  [index: string]: 'MANUAL' | 'ACTIVE' | 'ERROR' | 'NOT_FOUND' | 'CLOSED';
}
const ACCOUNT_STATUS_MAPPING: AccountStatusMapping = {
  [BridgeAccountStatus.OK]: 'ACTIVE',
};

/**
 * mapAccountStatus map the banksUser status from the bridge type
 * @param accountStatus Bridge type
 */
const mapAccountStatus = (accountStatus: BridgeAccountStatus): 'MANUAL' | 'ACTIVE' | 'ERROR' | 'NOT_FOUND' | 'CLOSED' =>
  ACCOUNT_STATUS_MAPPING[accountStatus] || 'ERROR';

/**
 * mapUsageType map the banksUser usage from the bridge type
 * @param isPro Bridge boolean
 */
const mapUsageType = (isPro: boolean): UsageType => (isPro ? UsageType.PROFESSIONAL : UsageType.PERSONAL);

/**
 * mapBridgeTransactions transforms a bridge transaction wrapper into
 * an array of banks user transactions
 *
 * @param bridgeTransactions TransactionWrapper from Bridge
 */
export const mapBridgeTransactions = (bridgeTransactions: BridgeTransaction[]): PostBanksUserTransactionDTO[] =>
  bridgeTransactions.map((transaction) => ({
    amount: transaction.amount,
    simplifiedDescription: transaction.description,
    description: transaction.raw_description,
    banksUserCardId: undefined, // @TODO: Can we get this?
    reference: transaction.id.toString(),
    userDescription: transaction.description,
    category: transaction.category.id.toString(), // @TODO: get category name from API
    type: BanksUserTransactionType.UNKNOWN,
    date: moment.tz(transaction.date, 'Europe/Paris').toISOString(),
  }));
