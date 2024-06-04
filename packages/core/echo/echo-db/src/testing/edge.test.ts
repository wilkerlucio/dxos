import { PublicKey } from '@dxos/keys';
import { describe, test } from '@dxos/test';
import { EchoTestBuilder, createDataAssertion } from './echo-test-builder';
import { EchoEdgeReplicator } from '../edge/echo-edge-replicator';
import { sleep } from 'effect/Clock';
import { log } from '@dxos/log';

// Requires wrangler running.
describe.only('edge integration', () => {
  test('replication', async () => {
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

    const root = db1._automerge._automergeDocLoader.getSpaceRootDocHandle();
    log.info('objects', {
      root: root.documentId,
      ...root.docSync().links,
    });

    await using db2 = await peer2.openDatabase(spaceKey, db1.rootUrl!);
    log.break();
    await sleep(1000); // Wait for replication.
    await dataAssertion.verify(db2);
  });
});
