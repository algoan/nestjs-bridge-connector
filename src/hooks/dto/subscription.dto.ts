import { IsNotEmpty } from 'class-validator';
import { SubscriptionStatus } from '@algoan/rest';
import { EventName } from '../enums/event-name.enum';

/**
 * Subscription
 */
export class SubscriptionDTO {
  @IsNotEmpty()
  public readonly id: string;
  @IsNotEmpty()
  public readonly target: string;
  @IsNotEmpty()
  public readonly eventName: EventName;
  @IsNotEmpty()
  public readonly status: SubscriptionStatus;
}
