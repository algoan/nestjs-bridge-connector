import {
  AccountInformation,
  AuthenticationResponse,
  BridgeAccount,
  BridgeAccountStatus,
  BridgeAccountType,
  BridgeRefreshStatus,
  BridgeTransaction,
  UserResponse,
} from './bridge.interface';

export const mockInvalidAccount: Partial<BridgeAccount> = {
  id: 1235,
  name: 'mockBridgeInvalidAccountName',
  status: BridgeAccountStatus.OK,
  status_code_info: 'mockStatusCodeInfo',
  status_code_description: 'mockStatusCodeDescription',
  item_id: 5,
  bank_id: 6,
  loan_details: {
    next_payment_date: '2019-04-30',
    next_payment_amount: 1000,
    maturity_date: '2026-12-31',
    opening_date: '2013-01-10',
    interest_rate: 1.25,
    type: 'Prêtimmobilier',
    borrowed_capital: 140200,
    repaid_capital: 40200,
    remaining_capital: 100000,
  },

  // eslint-disable-next-line no-null/no-null
  savings_details: null,
  iban: 'mockIban',
};

export const mockAccount: BridgeAccount = {
  id: 1234,
  name: 'mockBridgeAccountName',
  balance: 100,
  status: BridgeAccountStatus.OK,
  status_code_info: 'mockStatusCodeInfo',
  status_code_description: 'mockStatusCodeDescription',
  updated_at: '2019-04-06T13:53:12Z',
  type: BridgeAccountType.CARD,
  currency_code: 'USD',
  item_id: 5,
  bank_id: 6,
  loan_details: {
    next_payment_date: '2019-04-30',
    next_payment_amount: 1000,
    maturity_date: '2026-12-31',
    opening_date: '2013-01-10',
    interest_rate: 1.25,
    type: 'Prêtimmobilier',
    borrowed_capital: 140200,
    repaid_capital: 40200,
    remaining_capital: 100000,
  },

  // eslint-disable-next-line no-null/no-null
  savings_details: null,
  is_pro: false,
  iban: 'mockIban',
};
export const mockTransaction: BridgeTransaction = {
  id: 23,
  clean_description: 'mockDescription',
  bank_description: 'mockRawDescription',
  amount: 30,
  date: '2019-04-06T13:53:12Z',
  booking_date: '2019-04-06T13:53:12Z',
  updated_at: 'mockUpdatedAt',
  currency_code: 'USD',
  is_deleted: false,
  category_id: 78,
  account_id: 56,
  is_future: false,
};

export const mockUserResponse: UserResponse = {
  uuid: 'mockUuid',
  email: 'mock@email.com',
};

export const mockAuthResponse: AuthenticationResponse = {
  user: mockUserResponse,
  access_token: 'mockAccessToken',
  expires_at: 'mockDate',
};

export const mockAccountInformation: AccountInformation[] = [
  {
    item_id: 5869768,
    first_name: 'JEAN',
    last_name: 'DUPONT',
    accounts: [
      {
        id: 1234,
        name: 'Compte Courant de MR DUPONT',
        type: 'checking',
        currency_code: 'EUR',
        bank_id: 6,
        iban: 'FR3312739000309854725191G90',
      },
    ],
  },
  {
    item_id: 5869769,
    first_name: 'JANE',
    last_name: 'DOE',
    accounts: [
      {
        id: 27341560,
        name: 'Compte Courant de MME DOE',
        type: 'checking',
        currency_code: 'EUR',
        bank_id: 6,
        iban: 'FR3312739000309854725191G91',
      },
    ],
  },
];

export const mockRefreshStatus: BridgeRefreshStatus = {
  status: 'finished',
  refresh_at: new Date().toISOString(),
  mfa: null, // eslint-disable-line no-null/no-null
  refresh_accounts_count: 0,
  total_accounts_count: 0,
};
