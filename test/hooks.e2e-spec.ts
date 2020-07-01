import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { buildFakeApp } from './utils/app';

describe('HooksController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await buildFakeApp();
  });

  describe('POST /hooks', () => {
    it('HK001 - should be a bad request - no request body', async () => {
      return request(app.getHttpServer()).post('/hooks').send({}).expect(HttpStatus.BAD_REQUEST);
    });

    it('HK002 - should be a bad request - no event id', async () => {
      return request(app.getHttpServer())
        .post('/hooks')
        .send({
          subscription: {
            id: '1',
          },
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('HK003 - should be unauthorized - no service account found', async () => {
      return request(app.getHttpServer())
        .post('/hooks')
        .send({
          subscription: {
            id: 'unknown',
            target: 'http://',
            status: 'ACTIVE',
            eventName: 'bankreader_link_required',
          },
          id: 'random',
          index: 1,
          time: Date.now(),
          payload: {
            banksUserId: 'banks_user_id',
            applicationId: 'app_id',
          },
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('HK004 - should be ok', async () => {
      return request(app.getHttpServer())
        .post('/hooks')
        .send({
          subscription: {
            id: '1',
            target: 'http://',
            status: 'ACTIVE',
            eventName: 'service_account_deleted',
          },
          id: 'random',
          index: 1,
          time: Date.now(),
          payload: {
            banksUserId: 'banks_user_id',
            applicationId: 'app_id',
          },
        })
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
