//
// Copyright 2021 DXOS.org
//

import { expect } from 'chai';

import { Trigger, asyncTimeout } from '@dxos/async';
import { performInvitation } from '@dxos/client-services/testing';
import { invariant } from '@dxos/invariant';
import { describe, test, afterTest } from '@dxos/test';

import { Client } from '../client';
import { TestBuilder } from '../testing';

describe('Halo', () => {
  test('creates a identity', async () => {
    const testBuilder = new TestBuilder();

    const client = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client.destroy());
    await client.initialize();

    await client.halo.createIdentity({ displayName: 'test-user' });
    expect(client.halo.identity).exist;

    expect(await client.halo.devices.get()).to.have.lengthOf(1);
    expect(client.halo.identity.get()!.profile?.displayName).to.equal('test-user');
  });

  test('updates profile', async () => {
    const testBuilder = new TestBuilder();

    const client = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client.destroy());
    await client.initialize();

    await client.halo.createIdentity({ displayName: 'test-user' });
    expect(client.halo.identity.get()!.profile?.displayName).to.equal('test-user');

    await client.halo.updateProfile({ displayName: 'test-user-updated' });
    expect(client.halo.identity.get()!.profile?.displayName).to.equal('test-user-updated');
  });

  test('device invitations', async () => {
    const testBuilder = new TestBuilder();

    const client1 = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client1.destroy());
    await client1.initialize();

    await client1.halo.createIdentity({ displayName: 'test-user' });
    expect(client1.halo.identity).exist;

    expect(await client1.halo.devices.get()).to.have.lengthOf(1);

    const client2 = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client2.destroy());
    await client2.initialize();

    await Promise.all(performInvitation({ host: client1.halo, guest: client2.halo }));

    expect(await client1.halo.devices.get()).to.have.lengthOf(2);
    expect(await client2.halo.devices.get()).to.have.lengthOf(2);
  });

  test.only('identity profile update is visible to other devices', async () => {
    const testBuilder = new TestBuilder();

    const client1 = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client1.destroy());
    await client1.initialize();

    await client1.halo.createIdentity({ displayName: 'test-user' });
    expect(client1.halo.identity).exist;

    expect(await client1.halo.devices.get()).to.have.lengthOf(1);

    const client2 = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client2.destroy());
    await client2.initialize();

    await Promise.all(performInvitation({ host: client1.halo, guest: client2.halo }));

    expect(await client1.halo.devices.get()).to.have.lengthOf(2);

    const trigger = new Trigger();
    client2.halo.identity.subscribe((identity) => {
      if (identity?.profile?.displayName === 'test-user-updated') {
        trigger.wake();
      }
    });

    await client1.halo.updateProfile({ displayName: 'test-user-updated' });
    await asyncTimeout(trigger.wait(), 500);

    expect(client2.halo.identity.get()!.profile?.displayName).to.equal('test-user-updated');
  });

  test('device profile update is visible to other devices', async () => {
    const testBuilder = new TestBuilder();

    const client1 = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client1.destroy());
    await client1.initialize();

    await client1.halo.createIdentity({ displayName: 'test-user' });
    expect(client1.halo.identity).exist;

    expect(await client1.halo.devices.get()).to.have.lengthOf(1);

    const client2 = new Client({ services: testBuilder.createLocal() });
    afterTest(() => client2.destroy());
    await client2.initialize();

    await Promise.all(performInvitation({ host: client1.halo, guest: client2.halo }));

    expect(await client1.halo.devices.get()).to.have.lengthOf(2);
    expect(await client2.halo.devices.get()).to.have.lengthOf(2);

    invariant(client1.services.services?.DevicesService, 'DevicesService is not available');
    await client1?.services?.services?.DevicesService?.updateDevice({
      label: 'updated-device-profile',
    });

    const trigger = new Trigger();
    client2.halo.devices.subscribe((devices) => {
      if (
        devices.find((device) => device.deviceKey !== client1.halo.device?.deviceKey)?.profile?.label ===
        'updated-device-profile'
      ) {
        trigger.wake();
      }
    });

    await asyncTimeout(trigger.wait(), 500);
    expect(
      client2.halo.devices.get().find((device) => device.deviceKey !== client1.halo.device?.deviceKey)?.profile?.label,
    ).to.equal('updated-device-profile');
  });
});
