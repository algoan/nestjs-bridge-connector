import { EventName, Subscription } from '@algoan/rest';
import { Controller, Get, HttpCode, HttpStatus, Query, Render } from '@nestjs/common';
import { config } from 'node-config-ts';

import { AlgoanService } from './algoan/services/algoan.service';
import { AppService } from './app.service';

/**
 * App Controller with a GET / API
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly algoanService: AlgoanService) {}

  /**
   * GET / Hello
   */
  @Get('/ping')
  @HttpCode(HttpStatus.NO_CONTENT)
  public getPing(): string {
    return this.appService.getPing();
  }

  /**
   * Root index.html page to test BI process locally
   * NOTE: ⚠️ Should not be used in production
   */
  @Get()
  @Render('index')
  public async root(): Promise<IRootResult> {
    const appUrl: string = `http://localhost:${config.port}`;

    const subscription: Subscription | undefined =
      this.algoanService.algoanClient.serviceAccounts[0].subscriptions.find(
        (sub: Subscription) => sub.eventName === EventName.AGGREGATOR_LINK_REQUIRED,
      );

    return {
      subscription,
      token: await this.algoanService.algoanClient.serviceAccounts[0].getAuthorizationHeader(),
      algoanBaseUrl: config.algoan.baseUrl,
      callbackUrl: `${appUrl}/triggers`,
    };
  }

  /**
   * Triggers the "bank_details_required" event
   * @param customerId Customer id
   * @param code Code returned by bridge, in case of a success
   */
  @Get('/triggers')
  @Render('index')
  public async triggerEvent(
    @Query('user_uuid') code: string,
  ): Promise<IRootResult & { code: string; bankDetailsRequiredSubscription?: Subscription }> {
    const bankDetailsRequiredSubscription: Subscription | undefined =
      this.algoanService.algoanClient.serviceAccounts[0].subscriptions.find(
        (sub: Subscription) => sub.eventName === EventName.BANK_DETAILS_REQUIRED,
      );

    return {
      ...(await this.root()),
      code,
      bankDetailsRequiredSubscription,
    };
  }
}

/**
 * Root result to render the index.html file
 */
interface IRootResult {
  algoanBaseUrl: string;
  subscription?: Subscription;
  token: string;
  callbackUrl: string;
}
