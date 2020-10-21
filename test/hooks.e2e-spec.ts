import { INestApplication, HttpStatus } from '@nestjs/common';
import * as assert from 'assert';
import * as nock from 'nock';
import * as request from 'supertest';
import { buildFakeApp, fakeAlgoanBaseUrl } from './utils/app';
import { fakeAPI } from './utils/fake-server';

describe('HooksController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await buildFakeApp();
  });

  describe('POST /hooks', () => {
    // eslint-disable-next-line arrow-body-style
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
      const fakeSubEventServer: nock.Scope = fakeAPI({
        baseUrl: fakeAlgoanBaseUrl,
        method: 'patch',
        result: {},
        path: '/v1/subscriptions/1/events/random',
        nbOfCalls: 1,
      });

      await request(app.getHttpServer())
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

      assert.equal(fakeSubEventServer.isDone(), true);
    });
  });
});
