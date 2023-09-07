import {
  AccountInformation,
  AuthenticationResponse,
  BridgeAccount,
  BridgeAccountStatus,
  BridgeAccountType,
  BridgeRefreshStatus,
  BridgeTransaction,
  BridgeUserInformation,
  UserResponse,
} from './bridge.interface';

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

export const mockPersonalInformation: BridgeUserInformation[] = [
  {
    item_id: 1234567,
    sex: 'MALE',
    first_name: 'MICHEL',
    last_name: 'DUPONT',
    zip: '75001',
    address: '7 RUE DES MOULINS 75001 PARIS FRANCE',
    birthday: '1980-08-26',
    job: null, // eslint-disable-line no-null/no-null
    job_category: null, // eslint-disable-line no-null/no-null
    job_category_details: null, // eslint-disable-line no-null/no-null
    is_married: true,
    is_owner: false,
    nb_kids: 0,
  },
  {
    item_id: 5,
    sex: 'MALE',
    first_name: null, // eslint-disable-line no-null/no-null
    last_name: 'DUPONT',
    zip: '75001',
    address: null, // eslint-disable-line no-null/no-null
    birthday: '1980-08-26',
    job: 'Computer analyst',
    job_category: null, // eslint-disable-line no-null/no-null
    job_category_details: null, // eslint-disable-line no-null/no-null
    is_married: null, // eslint-disable-line no-null/no-null
    is_owner: null, // eslint-disable-line no-null/no-null
    nb_kids: null, // eslint-disable-line no-null/no-null
  },
];

export const mockAccountInformation: AccountInformation[] = [
  {
    item_id: 5869768,
    first_name: 'JEAN',
    last_name: 'DUPONT',
    accounts: [
      {
        id: 27341559,
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
