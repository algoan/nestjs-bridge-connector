import { IsNotEmpty, IsOptional } from 'class-validator';

/**
 * BankreaderRequired
 */
export class BankreaderRequiredDTO {
  @IsNotEmpty()
  @IsOptional()
  public readonly applicationId?: string;
  @IsNotEmpty()
  public readonly banksUserId: string;
  @IsOptional()
  @IsNotEmpty()
  public readonly temporaryCode?: string;
}
