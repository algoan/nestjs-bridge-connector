import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for the event `banks_details_required`
 */
export class BanksDetailsRequiredDTO {
  /** Id of the customer */
  @IsString()
  @IsNotEmpty()
  public readonly customerId: string;
  /** Id of the analysis */
  @IsString()
  @IsNotEmpty()
  public readonly analysisId: string;
  /** Temporary code to connect the user */
  @IsString()
  @IsOptional()
  public readonly temporaryCode?: string;
}
