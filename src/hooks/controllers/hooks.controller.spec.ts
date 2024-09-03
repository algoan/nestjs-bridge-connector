import { EventName } from '@algoan/rest';
import { ContextIdFactory } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { ConfigModule } from '../../config/config.module';
import { EventDTO } from '../dto/event.dto';
import { HooksService } from '../services/hooks.service';
import { HooksController } from './hooks.controller';

describe('Hooks Controller', () => {
  let controller: HooksController;
  let hooksService: HooksService;

  beforeEach(async () => {
    // To mock scoped DI
    const contextId = ContextIdFactory.create();
    jest.spyOn(ContextIdFactory, 'getByRequest').mockImplementation(() => contextId);

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule, ConfigModule],
      providers: [HooksService],
      controllers: [HooksController],
    }).compile();

    controller = await module.resolve<HooksController>(HooksController, contextId);
    hooksService = await module.resolve<HooksService>(HooksService, contextId);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should handle the webhook connection', async () => {
    const event: EventDTO = {
      subscription: {
        id: 'b3cf907a5a66c1a7f5490fe1',
        target: 'https://bankease.com/algoan-hook/',
        eventName: EventName.AGGREGATOR_LINK_REQUIRED,
        status: 'ACTIVE',
      },
      payload: {
        customerId: '2a0bf32e3180329b3167e777',
      },
      time: 1586177798388,
      index: 32,
      id: 'eventId',
    } as unknown as EventDTO;

    const spy = jest.spyOn(hooksService, 'handleWebhook').mockReturnValue(Promise.resolve());
    await controller.controlHook(event, {
      'x-hub-signature': 'sha256=7a21851efc6fb1dd6d526d22f9bed739b5a26d54f0ef6b03ef662dc184fdd27d',
    });
    expect(spy).toBeCalledWith(event, 'sha256=7a21851efc6fb1dd6d526d22f9bed739b5a26d54f0ef6b03ef662dc184fdd27d');
  });
});
