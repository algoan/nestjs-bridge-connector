import { IsNotEmpty, IsString } from 'class-validator';

/**
 * ServiceAccountUpdated DTO
 */
export class ServiceAccountUpdatedDTO {
  /**
   * Unique service account DTO
   */
  @IsNotEmpty()
  @IsString()
  public readonly serviceAccountId: string;
}
