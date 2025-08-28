import { BridgeAccount } from '../../aggregator/interfaces/bridge.interface';
import { AccountTransaction as AlgoanTransaction, Account as AlgoanAccount } from '../../algoan/dto/analysis.inputs';

/**
 * Masking placeholder for sensitive information.
 */
const MASKING_PLACEHOLDER = '***';

/**
 * Anonymizes sensitive information in Algoan transactions.
 * @param transaction - The Algoan transaction to anonymize.
 * @returns The anonymized Algoan transaction.
 */
const anonymizeAlgoanTransaction = (transaction: AlgoanTransaction) => ({
  ...transaction,
  description: MASKING_PLACEHOLDER,
});

/**
 * Anonymizes sensitive information in Algoan accounts.
 * @param account - The Algoan account to anonymize.
 * @returns The anonymized Algoan account.
 */
const anonymizeAlgoanAccount = (account: AlgoanAccount) => ({
  ...account,
  owners: MASKING_PLACEHOLDER,
  iban: MASKING_PLACEHOLDER,
  bic: MASKING_PLACEHOLDER,
  name: MASKING_PLACEHOLDER,
  transactions: account.transactions?.map(anonymizeAlgoanTransaction),
});

/**
 * Anonymizes sensitive information in Algoan accounts.
 * @param accounts - The Algoan accounts to anonymize.
 * @returns The anonymized Algoan accounts.
 */
export const anonymizeAlgoanAccounts = (accounts: AlgoanAccount[]) => accounts.map(anonymizeAlgoanAccount);

/**
 * Anonymizes sensitive information in bridge accounts.
 * @param accounts - The bridge accounts to anonymize.
 * @returns The anonymized bridge accounts.
 */
export const anonymizeBridgeAccounts = (accounts: BridgeAccount[]) =>
  accounts.map((account) => ({
    ...account,
    name: MASKING_PLACEHOLDER,
    iban: MASKING_PLACEHOLDER,
    bic: MASKING_PLACEHOLDER,
    transactions: MASKING_PLACEHOLDER,
  }));
