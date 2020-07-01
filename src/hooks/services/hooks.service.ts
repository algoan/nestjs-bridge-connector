import { ServiceAccount } from '@algoan/rest';
import { UnauthorizedException, Injectable } from '@nestjs/common';

import { AlgoanService } from '../../algoan/algoan.service';
import { EventDTO } from '../dto/event.dto';

/**
 * Hook service
 */
@Injectable()
export class HooksService {
  constructor(private readonly algoanService: AlgoanService) {}

  /**
   * Handle Algoan webhooks
   * @param event Event listened to
   * @param signature Signature headers, to check if the call is from Algoan
   */
  public async handleWebhook(event: EventDTO, signature: string): Promise<void> {
    const serviceAccount:
      | ServiceAccount
      | undefined = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);

    if (serviceAccount === undefined) {
      throw new UnauthorizedException(`No service account found for subscription ${event.subscription.id}`);
    }

    return;
  }
}
