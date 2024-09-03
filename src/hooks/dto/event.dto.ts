import { Type } from 'class-transformer';
import { Allow, IsInt, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

import { AggregatorLinkRequiredDTO } from './aggregator-link-required.dto';
import { BanksDetailsRequiredDTO } from './bank-details-required.dto';
import { ServiceAccountCreatedDTO } from './service-account-created.dto';
import { ServiceAccountDeletedDTO } from './service-account-deleted.dto';
import { ServiceAccountUpdatedDTO } from './service-account-updated.dto';
import { SubscriptionDTO } from './subscription.dto';

/**
 * Events payload types
 */
type Events =
  | ServiceAccountCreatedDTO
  | ServiceAccountDeletedDTO
  | AggregatorLinkRequiredDTO
  | BanksDetailsRequiredDTO
  | ServiceAccountUpdatedDTO;

/**
 * Event
 */
export class EventDTO {
  @ValidateNested()
  @Type(() => SubscriptionDTO)
  public readonly subscription: SubscriptionDTO;
  @Allow()
  public readonly payload: Events;
  @IsInt()
  public readonly index: number;
  @IsOptional()
  @IsInt()
  public readonly time: number;

  @IsNotEmpty()
  public readonly id: string;
}
