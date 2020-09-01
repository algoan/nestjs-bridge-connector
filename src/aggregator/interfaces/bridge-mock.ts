import {
  BridgeAccount,
  BridgeAccountStatus,
  BridgeAccountType,
  BridgeTransaction,
  BridgeItem,
  UserResponse,
  AuthenticationResponse,
} from './bridge.interface';

export const mockAccount: BridgeAccount = {
  id: 1234,
  resource_uri: 'mockResourceUri',
  resource_type: 'account',
  name: 'mockBridgeAccountName',
  balance: 100,
  status: BridgeAccountStatus.OK,
  status_code_info: 'mockStatusCodeInfo',
  status_code_description: 'mockStatusCodeDescription',
  updated_at: '2019-04-06T13:53:12Z',
  type: BridgeAccountType.CARD,
  currency_code: 'USD',
  item: {
    id: 5,
    resource_uri: 'mockItemUri',
    resource_type: 'item',
  },
  bank: {
    id: 6,
    resource_uri: 'mockBankUri',
    resource_type: 'bank',
  },
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
  resource_uri: 'mockResourceUri',
  resource_type: 'transaction',
  description: 'mockDescription',
  raw_description: 'mockRawDescription',
  amount: 30,
  date: '2019-04-06T13:53:12Z',
  updated_at: 'mockUpdatedAt',
  currency_code: 'USD',
  is_deleted: false,
  category: {
    id: 78,
    resource_uri: 'mockCategoryUri',
    resource_type: 'category',
  },
  account: {
    id: 56,
    resource_uri: 'mockResourceUri',
    resource_type: 'account',
  },
  is_future: false,
};

export const mockUserResponse: UserResponse = {
  uuid: 'mockUuid',
  resource_type: 'user',
  resource_uri: 'mockUri',
  email: 'mock@email.com',
};

export const mockAuthResponse: AuthenticationResponse = {
  user: mockUserResponse,
  access_token: 'mockAccessToken',
  expires_at: 'mockDate',
};

export const mockItem: BridgeItem = {
  status: 0,
};
