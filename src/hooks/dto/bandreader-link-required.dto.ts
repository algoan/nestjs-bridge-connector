import { IsNotEmpty } from 'class-validator';

/**
 * BankreaderLinkRequired
 */
export class BankreaderLinkRequiredDTO {
  @IsNotEmpty()
  public readonly applicationId: string;
  @IsNotEmpty()
  public readonly banksUserId: string;
}
