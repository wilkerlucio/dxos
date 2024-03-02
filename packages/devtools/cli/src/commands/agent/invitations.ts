//
// Copyright 2024 DXOS.org
//

import chalk from 'chalk';

import { type Client } from '@dxos/client';

import { BaseCommand } from '../../base-command';

export default class Share extends BaseCommand<typeof Share> {
  static override enableJsonFlag = true;
  static override description = 'List valid invitations.';

  static override flags = {
    ...super.flags,
  };

  async run(): Promise<any> {
    return await this.execWithClient(async (client: Client) => {
      if (!client.halo.identity.get()) {
        this.log(chalk`{red Profile not initialized.}`);
        return {};
      }

      // TODO(nf): implement
    });
  }
}
