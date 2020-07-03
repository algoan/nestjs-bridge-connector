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
