import { IServiceAccount, RequestBuilder, ServiceAccount } from '@algoan/rest';
import { Inject, Injectable } from '@nestjs/common';
import { Config } from 'node-config-ts';

import { CONFIG } from '../../config/config.module';
import { PaginatedData } from '../interfaces';
/**
 * Service to manage analysis
 */
@Injectable()
export class AlgoanServiceAcountService {
  private readonly apiVersion: string = 'v2';
  // Note: here we have to instantiate a request builder instead of using the algoanhttp module
  // because algoanhttp's scope is REQUEST and we can't use a REQUEST scopped module in a onModuleInit
  // and we have to get the service account on initing the module
  private readonly requestBuilder = new RequestBuilder(
    this.config.algoan.baseUrl,
    {
      clientId: this.config.algoan.clientId,
      clientSecret: this.config.algoan.clientSecret,
    },
    {
      version: this.config.algoan.version,
    },
  );

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  /**
   * Find all service accounts linekd to the connector
   */
  public async findAll(): Promise<ServiceAccount[]> {
    const path: string = `/${this.apiVersion}/service-accounts?limit=1000`;
    const paginatedServiceAccounts: PaginatedData<IServiceAccount> = await this.requestBuilder.request({
      url: path,
      method: 'GET',
    });

    return paginatedServiceAccounts.resources.map(
      (sa: IServiceAccount) =>
        new ServiceAccount(this.config.algoan.baseUrl, sa, {
          apiVersion: this.config.algoan.version,
        }),
    );
  }

  /**
   * Find a service account by id
   */
  public async findById(id: string): Promise<ServiceAccount | undefined> {
    /* eslint-disable-next-line @typescript-eslint/naming-convention,camelcase */
    const path: string = `/${this.apiVersion}/service-accounts?filter=${JSON.stringify({ _id: id })}`;
    const paginatedServiceAccounts: PaginatedData<IServiceAccount> = await this.requestBuilder.request({
      url: path,
      method: 'GET',
    });
    if (paginatedServiceAccounts.resources.length > 0) {
      return new ServiceAccount(this.config.algoan.baseUrl, paginatedServiceAccounts.resources?.[0], {
        apiVersion: this.config.algoan.version,
      });
    }
  }
}
