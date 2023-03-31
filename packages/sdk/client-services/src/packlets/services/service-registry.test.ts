//
// Copyright 2022 DXOS.org
//

import assert from 'node:assert';

import { Trigger } from '@dxos/async';
import { ClientServices, SpaceInvitationsProxy } from '@dxos/client';
import { log } from '@dxos/log';
import { schema } from '@dxos/protocols';
import { Invitation, SpaceInvitationsService } from '@dxos/protocols/proto/dxos/client/services';
import { createLinkedPorts, createProtoRpcPeer, createServiceBundle } from '@dxos/rpc';
import { describe, test } from '@dxos/test';

import { SpaceInvitationsServiceImpl } from '../invitations';
import { createServiceContext } from '../testing';
import { ServiceRegistry } from './service-registry';

// TODO(burdon): Create TestService (that doesn't require peers).

type TestServices = {
  SpaceInvitationsService: SpaceInvitationsService;
};

const serviceBundle = createServiceBundle<TestServices>({
  SpaceInvitationsService: schema.getService('dxos.client.services.SpaceInvitationsService')
});

describe('service registry', () => {
  test('builds a service registry', async () => {
    const serviceContext = createServiceContext();
    await serviceContext.open();
    await serviceContext.createIdentity();

    assert(serviceContext.dataSpaceManager);
    assert(serviceContext.spaceInvitations);
    const space = await serviceContext.dataSpaceManager.createSpace();

    const serviceRegistry = new ServiceRegistry(serviceBundle, {
      SpaceInvitationsService: new SpaceInvitationsServiceImpl(
        serviceContext.identityManager,
        () => serviceContext.spaceInvitations!,
        () => serviceContext.dataSpaceManager!
      )
    });

    const [proxyPort, serverPort] = createLinkedPorts();

    const proxy = createProtoRpcPeer({
      requested: serviceRegistry.descriptors,
      exposed: {},
      handlers: {},
      port: proxyPort
    });

    const server = createProtoRpcPeer({
      exposed: serviceRegistry.descriptors,
      handlers: serviceRegistry.services as ClientServices,
      port: serverPort
    });

    log('opening...');
    await Promise.all([proxy.open(), server.open()]);
    log('open');

    const done = new Trigger(); // createRpcServer

    {
      const spaceInvitationsProxy = new SpaceInvitationsProxy(proxy.rpc.SpaceInvitationsService);
      const observer = spaceInvitationsProxy.createInvitation(space.key);
      observer.subscribe((invitation: Invitation) => {
        switch (invitation.state) {
          case Invitation.State.CONNECTING: {
            log('connecting', invitation);
            void observer.cancel();
            break;
          }

          case Invitation.State.CANCELLED: {
            done.wake();
          }
        }
      });
    }

    await done.wait();

    // TODO(burdon): Error handling (create tests).
    //  Uncaught Error: Request was terminated because the RPC endpoint is closed.
    // log('closing...');
    // await Promise.all([proxy.close(), server.close()]);
    // await serviceContext.close();
    // log('closed');
  });
});
