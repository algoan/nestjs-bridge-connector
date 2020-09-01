/**
 * Base response for all bridge requests
 */
export interface UserResponse {
  uuid: string;
  resource_type: string;
  resource_uri: string;
  email: string;
}

/**
 * Response for authentication request
 */
export interface AuthenticationResponse {
  access_token: string;
  expires_at: string;
  user: UserResponse;
}

/**
 * User Account
 */
export interface UserAccount {
  email: string;
  password: string;
}

/**
 * Response for connect item
 */
export interface ConnectItemResponse {
  redirect_url: string;
}

/**
 * Response for listing bridge objects
 */
export interface ListResponse<T> {
  resources: T[];
  pagination: {
    previous_uri: string | null;
    next_uri: string | null;
  };
}

/**
 * Bridge Account
 */
export interface BridgeAccount {
  id: number;
  resource_uri: string;
  resource_type: 'account';
  name: string;
  balance: number;
  status: BridgeAccountStatus;
  status_code_info: string | null; // improve with https://docs.bridgeapi.io/docs/items-status
  status_code_description: string | null; // improve with https://docs.bridgeapi.io/docs/items-status
  updated_at: string;
  type: BridgeAccountType;
  currency_code: string; // do we have an enum for this?
  item: {
    id: number;
    resource_uri: string;
    resource_type: 'item';
  };
  bank: {
    id: number;
    resource_uri: string;
    resource_type: 'bank';
  };
  loan_details: {
    next_payment_date: string;
    next_payment_amount: number;
    maturity_date: string;
    opening_date: string;
    interest_rate: number;
    type: string; // improve with https://docs.bridgeapi.io/reference#account-resource
    borrowed_capital: number;
    repaid_capital: number;
    remaining_capital: number;
  };
  savings_details: null; // couldn't findn ann example of this
  is_pro: boolean;
  iban: string;
}

/**
 * Bridge AccountType
 */
export enum BridgeAccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  SECURITIES = 'securities',
  CARD = 'card',
  LOAN = 'loan',
  SHARE_SAVINGS_PLAN = 'share_savings_plan',
  PENDING = 'pending',
  LIFE_INSURANCE = 'life_insurance',
  SPECIAL = 'special',
  UNKNOWN = 'unknown',
}

/* eslint-disable no-magic-numbers */
/**
 * Bridge AccountStatus
 */
export enum BridgeAccountStatus {
  OK = 0, //	Everything is awesome.
  JUST_ADDED = -2, //		The account was recently added. The account refresh is pending.
  JUSST_EDITED = -3, //	The account's credentials were recently changed. The account refresh is pending.
  LOGIN_FAILED = 402, //	Wrong credentials.
  NEEDS_HUMAN_ACTION = 429, //	An action from the user is required within the online banking of the user.
  NEEDS_PASSWORD_ROTATION = 430, //	The User needs to log onto his bank's website to change his password.
  COULD_NOT_REFRESH = 1003, //	Couldn't refresh. Try again.
  NOT_SUPPORTED = 1005, //	Account not supported.
  DISABLED_TEMPORARILY = 1007, //	Refresh temporarily disabled.
  INCOMPLETE = 1009, //	Account balance has changed but no new transactions were found.
  NEEDS_MANUAL_REFRESH = 1010, //	Item wasn't refreshed successfully, it required an MFA / OTP that wasn't provided, see Strong Customer Authentication.
  MIGRATION = 1099, //	Item is migrating to another bank.
  PRO_ACCOUNT_LOCKED = 1100, //	Pro accounts have been detected on this Item and it needs validation. Otherwise the data will be obfuscated.
}
/* eslint-enable no-magic-numbers */

/**
 * Bridge Transaction
 */
export interface BridgeTransaction {
  id: number;
  resource_uri: string;
  resource_type: 'transaction';
  description: string;
  raw_description: string;
  amount: number;
  date: string;
  updated_at: string;
  currency_code: string; // @TODO: do we have an enum for that?
  is_deleted: boolean;
  category: {
    id: number;
    resource_uri: string;
    resource_type: 'category';
  };
  account: {
    id: number;
    resource_uri: string;
    resource_type: 'account';
  };
  is_future: boolean;
}

/**
 * Bridge Bank
 */
export interface BridgeBank {
  id: number;
  resource_uri: string;
  resource_type: 'bank';
  name: string;
  country_code: string;
  automatic_refresh: boolean;
}

/**
 * Bridge Category
 */
export interface BridgeCategory {
  id: number;
  resource_uri: string;
  resource_type: 'category';
  name: string;
  parent?: {
    id: number;
    resource_uri: string;
    resource_type: string;
  };
}

/**
 * Bridge Item
 * (for now, we only need those fields)
 */
export interface BridgeItem {
  status: number;
}
