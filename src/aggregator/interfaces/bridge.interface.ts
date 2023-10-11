/**
 * DTO interface for the POST /items/add API
 * Refer to https://docs.bridgeapi.io/reference/connect-an-item
 */
export interface BrideConnectItemDTO {
  country?: string;
  prefill_email?: string;
  redirect_url?: string;
  context?: string;
  bank_id?: number;
  capabilities?: string;
  parent_url?: string;
}

/**
 * Base response for all bridge requests
 */
export interface UserResponse {
  uuid: string;
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
  name: string;
  balance: number;
  status: BridgeAccountStatus;
  status_code_info: string | null; // improve with https://docs.bridgeapi.io/docs/items-status
  status_code_description: string | null; // improve with https://docs.bridgeapi.io/docs/items-status
  updated_at: string;
  type: BridgeAccountType;
  currency_code: string; // do we have an enum for this?
  item_id: number;
  bank_id: number;
  loan_details: {
    next_payment_date: string;
    next_payment_amount: number;
    maturity_date: string;
    opening_date: string;
    /**
     * Interest rate in percentage
     */
    interest_rate: number;
    type: string; // improve with https://docs.bridgeapi.io/reference#account-resource
    borrowed_capital: number;
    repaid_capital: number;
    remaining_capital: number;
  } | null;
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
  BROKERAGE = 'brokerage',
  CARD = 'card',
  LOAN = 'loan',
  SHARED_SAVING_PLAN = 'shared_saving_plan',
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
  clean_description: string;
  bank_description: string;
  amount: number;
  date: string;
  booking_date?: string;
  updated_at: string;
  currency_code: string; // @TODO: do we have an enum for that?
  is_deleted: boolean;
  category_id: number;
  account_id: number;
  is_future: boolean;
  show_client_side?: boolean;
}

/**
 * Bridge Bank
 */
export interface BridgeBank {
  id: number;
  name: string;
  parent_name?: string;
  country_code?: string;
  primary_color?: string;
  secondary_color?: string;
  logo_url: string;
  deeplink_ios?: string;
  deeplink_android?: string;
  form?: {
    label: string;
    type: string;
    isNum: string;
    maxLength: number;
  }[];
  // Parameters below are not detailed because Algoan does not need this.
  // Refer to https://docs.bridgeapi.io/reference/bank-resource
  capabilities?: string[];
  transfer?: object;
  payment?: object;
  channel_type?: string[];
}

/**
 * Bridge Category
 */
export interface BridgeCategory {
  id: number;
  name: string;
  parent_id: number;
}

/**
 * Bridge User Information
 */
export interface BridgeUserInformation {
  item_id: number;
  sex?: 'FEMALE' | 'MALE' | null;
  first_name?: string | null;
  last_name?: string | null;
  zip?: string | null;
  address?: string | null;
  birthday?: Date | string | null;
  job?: string | null;
  job_category?: string | null; // @TODO: do we have an enum for that?
  job_category_details?: string | null; // @TODO: do we have an enum for that?
  is_married?: boolean | null;
  is_owner?: boolean | null;
  nb_kids?: number | null;
}

/**
 * Bridge Account Information
 */
export interface AccountInformation {
  item_id: number;
  first_name?: string | null;
  last_name?: string | null;
  accounts?: BridgeSimpleAccount[];
}

/**
 * Bridge Account Simplified
 */
export interface BridgeSimpleAccount {
  id: number;
  name: string;
  type: string;
  currency_code: string;
  bank_id: number;
  iban: string;
}

/**
 * Status of a refresh
 * https://docs.bridgeapi.io/reference#get-a-refresh-status
 */
export interface BridgeRefreshStatus {
  status: string;
  refresh_at: Date | string;
  mfa?: Record<string, unknown> | null;
  refresh_accounts_count?: number | null;
  total_accounts_count?: number | null;
}
