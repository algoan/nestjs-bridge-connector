import { IsString } from 'class-validator';

/**
 * Client Config
 */
export class ClientConfig {
  @IsString()
  public clientId: string;

  @IsString()
  public clientSecret: string;

  @IsString()
  public bankinVersion: string;
}
