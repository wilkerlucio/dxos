//
// Copyright 2023 DXOS.org
//

import chalk from 'chalk';

import { type Client, PublicKey } from '@dxos/client';
import { Context } from '@dxos/context';
import { verifyCredentialSignature } from '@dxos/credentials';
import { invariant } from '@dxos/invariant';
import { log } from '@dxos/log';
import { InitAuthSequenceResponse } from '@dxos/protocols/proto/dxos/service/agentmanager';

import { BaseCommand } from '../../base-command';
import { type AgentManagerRpcPeer, queryCredentials } from '../../util';

export default class Start extends BaseCommand<typeof Start> {
  static override enableJsonFlag = true;
  static override description = 'Starts the agent.';
  static override flags = {
    ...BaseCommand.flags,
  };

  private readonly _ctx = new Context();

  async presentAuthCredentials(client: Client): Promise<any> {
    this.log(chalk`{gray Initiating presentation sequence..}`);
    // TODO(egorgripasov): Find AuthorizedDevice by KubeAccess credential.
    const { deviceKey } = client.halo.device!;
    const authDeviceCreds = await queryCredentials(client, 'dxos.halo.credentials.AuthorizedDevice', (cred) =>
      PublicKey.equals(cred.subject.id, deviceKey!),
    );

    if (!authDeviceCreds.length) {
      this.catch('No authorized devices');
    }

    // Init auth sequence.
    return this.execWithAgentManager(async (agentManager: AgentManagerRpcPeer) => {
      // TODO(nf): take auth token as cli param
      const { result, nonce, agentmanagerKey, initAuthResponseReason } = await agentManager.rpc.initAuthSequence({});

      if (result !== InitAuthSequenceResponse.InitAuthSequenceResult.SUCCESS || !nonce || !agentmanagerKey) {
        log('auth init failed', { result, nonce, agentmanagerKey, initAuthResponseReason });
        throw new Error('Failed to initialize auth sequence');
      }
      this.log('auth init', { nonce, agentmanagerKey });

      // Find proper KubeAccess credential.
      const kubeAccessCreds = await queryCredentials(client, 'dxos.halo.credentials.KubeAccess', (cred) =>
        PublicKey.equals(cred.issuer, agentmanagerKey),
      );

      if (!kubeAccessCreds.length) {
        this.log(chalk`{gray No KUBE access credentials - requesting...}`);
      } else {
        this.log(chalk`{gray KUBE access credentials found - requesting session token..}`);
      }

      const credsToPresent = [authDeviceCreds[0].id, kubeAccessCreds[0]?.id].filter(Boolean);
      // Create presentation.
      log.warn('present creds', { cred: credsToPresent[0]!.truncate(), nonce });
      const presentation = await client.halo.presentCredentials({
        ids: credsToPresent as PublicKey[],
        nonce,
      });
      // log.warn('presentation', { presentation });
      // const verifyResult = await verifyPresentation(presentation);
      // log.warn('verify', { verifyResult });

      // const verifyPresentationResult = await verifyPresentationSignature(presentation, presentation.proofs![0]);
      // log.warn('verify', { verifyPresentationResult });

      const verifyCredentialResult = await verifyCredentialSignature(presentation.credentials![0]);
      log.warn('verify', { verifyCredentialResult });

      return agentManager.rpc.authenticate({
        presentation,
      });
    });
  }

  async run(): Promise<any> {
    return await this.execWithClient(async (client: Client) => {
      const identity = client.halo.identity;
      if (!identity) {
        // TODO(burdon): Error if called twice with no halo.
        this.log(chalk`{red Profile not initialized.}`);
      } else {
        const { credential, token } = await this.presentAuthCredentials(client);
        log.warn('received credential', { credential, token });
        invariant(!!credential || !!token, 'No credentials or token received.');

        if (token) {
          this.log(chalk`{green Authenticated with session token ${token}}`);
        } else {
          this.log(chalk`{gray Writing KUBE access credential..}`);
          await client.halo.writeCredentials([credential]);

          const { token } = await this.presentAuthCredentials(client);
          if (token) {
            this.log(chalk`{green Authenticated with session token: ${token}}`);
          } else {
            this.log(chalk`{red Failed to authenticate.}`);
          }
        }
      }
    });
  }
}
