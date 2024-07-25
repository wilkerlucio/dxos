import { Context } from '@dxos/context';
import { AutomergeHost } from '@dxos/echo-pipeline';
import { IndexMetadataStore } from '@dxos/indexing';
import { PublicKey } from '@dxos/keys';
import { createTestLevel } from '@dxos/kv-store/testing';
import { log } from '@dxos/log';
import { afterTest, describe, test } from '@dxos/test';
import { expect } from 'chai';
import { EchoEdgeReplicator } from '../edge/echo-edge-replicator';
import { EchoTestBuilder, createDataAssertion } from './echo-test-builder';
import { sleep } from '@dxos/async';

// Requires wrangler running.
describe.only('edge integration', () => {
  test('doc replication', async () => {
    const host1 = await setupAutomergeHost();
    const host2 = await setupAutomergeHost();

    host1.addReplicator(
      new EchoEdgeReplicator({
        url: `ws://localhost:8787/replicate/00000000000`,
      }),
    );

    host2.addReplicator(
      new EchoEdgeReplicator({
        url: `ws://localhost:8787/replicate/00000000000`,
      }),
    );

    const handle1 = host1.createDoc({
      text: 'hello',
    });

    const handle2 = await host2.loadDoc(Context.default(), handle1.documentId);
    expect(handle2.docSync().text).to.eq('hello');
  });

  test('2 doc replication', async () => {
    const host1 = await setupAutomergeHost();
    const host2 = await setupAutomergeHost();

    host1.addReplicator(
      new EchoEdgeReplicator({
        url: `ws://localhost:8787/replicate/00000000000`,
      }),
    );

    host2.addReplicator(
      new EchoEdgeReplicator({
        url: `ws://localhost:8787/replicate/00000000000`,
      }),
    );

    const handle1a = host1.createDoc({
      text: 'hello',
    });
    const handle1b = host1.createDoc({
      text: 'world',
    });

    const handle2a = await host2.loadDoc(Context.default(), handle1a.documentId);
    expect(handle2a.docSync().text).to.eq('hello');

    const handle2b = await host2.loadDoc(Context.default(), handle1b.documentId);
    expect(handle2b.docSync().text).to.eq('world');
  });

  test.only('database replication', async () => {
    await using builder = await new EchoTestBuilder().open();

    const [spaceKey] = PublicKey.randomSequence();
    const dataAssertion = createDataAssertion();

    await using peer1 = await builder.createPeer();
    await using peer2 = await builder.createPeer();

    peer1.host.addReplicator(
      new EchoEdgeReplicator({
        url: `ws://localhost:8787/replicate/00000000000`,
      }),
    );

    peer2.host.addReplicator(
      new EchoEdgeReplicator({
        url: `ws://localhost:8787/replicate/00000000000`,
      }),
    );

    await using db1 = await peer1.createDatabase(spaceKey);
    await dataAssertion.seed(db1);

    const root = db1.coreDatabase._automergeDocLoader.getSpaceRootDocHandle();
    log.info('objects', {
      root: root.documentId,
      ...root.docSync().links,
    });

    await using db2 = await peer2.openDatabase(spaceKey, db1.rootUrl!);
    log.break();
    await dataAssertion.waitForReplication(db2);
    await dataAssertion.verify(db2);
  });
});

const setupAutomergeHost = async (): Promise<AutomergeHost> => {
  const kv = createTestLevel();
  await kv.open();
  afterTest(() => kv.close());
  const host = await new AutomergeHost({
    db: kv,
    indexMetadataStore: new IndexMetadataStore({ db: kv.sublevel('index-metadata') }),
  }).open();
  afterTest(() => host.close());
  return host;
};
