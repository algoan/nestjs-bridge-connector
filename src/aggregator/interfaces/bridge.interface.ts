/**
 * Base respone for all bridge requests
 */
export interface BaseResponse {
  uuid: string;
  resource_type: string;
  resource_uri: string;
  email: string;
}

/**
 * User Account
 */
export interface UserAccount {
  email: string;
  password: string;
}
