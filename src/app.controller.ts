import { Controller, Get, HttpCode, HttpStatus, Param, Query, Render } from '@nestjs/common';
import { config } from 'node-config-ts';
import { Subscription, EventName } from '@algoan/rest';

import { AppService } from './app.service';
import { AlgoanService } from './algoan/algoan.service';

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

    const subscription: Subscription = this.algoanService.algoanClient.serviceAccounts[0].subscriptions.find(
      (sub: Subscription) => sub.eventName === EventName.BANKREADER_LINK_REQUIRED,
    );

    return {
      subscription,
      token: await this.algoanService.algoanClient.serviceAccounts[0].getAuthorizationHeader(),
      algoanBaseUrl: config.algoan.baseUrl,
      callbackUrl: `${appUrl}/triggers`,
    };
  }

  /**
   * Triggers the "bankreader_required" event
   * @param banksUserId Banks User id
   * @param code Code returned by budget insight, in case of a success
   */
  @Get('/triggers')
  @Render('index')
  public async triggerEvent(
    @Query('code') code: string,
  ): Promise<IRootResult & { code: string; bankreaderRequiredSubscription: Subscription }> {
    const bankreaderRequiredSubscription: Subscription = this.algoanService.algoanClient.serviceAccounts[0].subscriptions.find(
      (sub: Subscription) => sub.eventName === EventName.BANKREADER_REQUIRED,
    );

    return {
      ...(await this.root()),
      code,
      bankreaderRequiredSubscription,
    };
  }
}

/**
 * Root result to render the index.html file
 */
interface IRootResult {
  algoanBaseUrl: string;
  subscription: Subscription;
  token: string;
  callbackUrl: string;
}
