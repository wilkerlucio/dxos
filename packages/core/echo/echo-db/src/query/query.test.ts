//
// Copyright 2022 DXOS.org
//

import { expect } from 'chai';

import { asyncTimeout, sleep, Trigger } from '@dxos/async';
import { type AutomergeUrl } from '@dxos/automerge/automerge-repo';
import { type SpaceDoc } from '@dxos/echo-protocol';
import { create, type EchoReactiveObject, Expando } from '@dxos/echo-schema';
import { PublicKey } from '@dxos/keys';
import { createTestLevel } from '@dxos/kv-store/testing';
import { QueryOptions } from '@dxos/protocols/proto/dxos/echo/filter';
import { afterAll, afterTest, beforeAll, beforeEach, describe, test } from '@dxos/test';
import { range } from '@dxos/util';

import { Filter } from './filter';
import { getObjectCore } from '../core-db';
import { type EchoDatabase } from '../proxy-db';
import { Contact, EchoTestBuilder, TestBuilder } from '../testing';

const createTestObject = (idx: number, label?: string) => {
  return create(Expando, { idx, title: `Task ${idx}`, label });
};

describe('Queries', () => {
  describe('Query with different filters', () => {
    let builder: EchoTestBuilder;
    let db: EchoDatabase;

    beforeEach(async () => {
      builder = await new EchoTestBuilder().open();

      ({ db } = await builder.createDatabase());

      const objects = [createTestObject(9)]
        .concat(range(3).map((idx) => createTestObject(idx, 'red')))
        .concat(range(2).map((idx) => createTestObject(idx + 3, 'green')))
        .concat(range(4).map((idx) => createTestObject(idx + 5, 'blue')));

      for (const object of objects) {
        db.add(object);
      }

      await db.flush();
    });

    afterEach(async () => {
      await builder.close();
    });

    test('filter properties', async () => {
      {
        const { objects } = await db.query().run();
        expect(objects).to.have.length(10);
      }

      {
        const { objects, results } = await db.query({ label: undefined }).run();
        expect(objects).to.have.length(1);

        // TODO(dmaretskyi): 2 hits: one local one from index, we should dedup those.
        expect(results).to.have.length(2);
        expect(results.every((result) => result.id === objects[0].id)).to.be.true;

        expect(results[0].object).to.eq(objects[0]);
        expect(results[0].id).to.eq(objects[0].id);
        expect(results[0].spaceKey).to.eq(db.spaceKey);
      }

      {
        const { objects } = await db.query({ label: 'red' }).run();
        expect(objects).to.have.length(3);
      }

      {
        const { objects } = await db.query({ label: 'pink' }).run();
        expect(objects).to.have.length(0);
      }
    });

    test('filter operators', async () => {
      {
        const { objects } = await db.query(() => false).run();
        expect(objects).to.have.length(0);
      }

      {
        const { objects } = await db.query(() => true).run();
        expect(objects).to.have.length(10);
      }

      {
        const { objects } = await db
          .query((object: Expando) => object.label === 'red' || object.label === 'green')
          .run();
        expect(objects).to.have.length(5);
      }
    });

    test('filter chaining', async () => {
      {
        // prettier-ignore
        const { objects } = await db.query([
        () => true,
        { label: 'blue' },
        (object: any) => object.idx > 6
      ]).run();
        expect(objects).to.have.length(2);
      }
    });

    test('options', async () => {
      {
        const { objects } = await db.query({ label: 'red' }).run();
        expect(objects).to.have.length(3);

        for (const object of objects) {
          db.remove(object);
        }
        await db.flush();
      }

      {
        const { objects } = await db.query().run();
        expect(objects).to.have.length(7);
      }

      {
        const { objects } = await db.query(undefined, { deleted: QueryOptions.ShowDeletedOption.HIDE_DELETED }).run();
        expect(objects).to.have.length(7);
      }

      {
        const { objects } = await db.query(undefined, { deleted: QueryOptions.ShowDeletedOption.SHOW_DELETED }).run();
        expect(objects).to.have.length(10);
      }

      {
        const { objects } = await db
          .query(undefined, { deleted: QueryOptions.ShowDeletedOption.SHOW_DELETED_ONLY })
          .run();
        expect(objects).to.have.length(3);
      }
    });
  });

  test('query.run() queries everything after restart', async () => {
    const kv = createTestLevel();
    const spaceKey = PublicKey.random();

    const builder = new EchoTestBuilder();
    afterTest(() => builder.close());

    let root: AutomergeUrl;
    {
      const peer = await builder.createPeer(kv);

      const db = await peer.createDatabase(spaceKey);
      db.add(createTestObject(0, 'red'));
      db.add(createTestObject(1, 'blue'));
      db.add(createTestObject(2, 'yellow'));
      await db.flush();
      await peer.host.updateIndexes();

      expect((await db.query().run()).objects.length).to.eq(3);
      root = db.coreDatabase._automergeDocLoader.getSpaceRootDocHandle().url;
    }

    {
      const peer = await builder.createPeer(kv);

      const db = await peer.openDatabase(spaceKey, root);

      expect((await db.query().run()).objects.length).to.eq(3);
    }
  });

  test('single document load query timeout does not fail the whole query', async () => {
    const kv = createTestLevel();
    const spaceKey = PublicKey.random();
    kv.values();

    const builder = new EchoTestBuilder();
    afterTest(() => builder.close());

    let root: AutomergeUrl;
    let expectedObjectId: string;
    {
      const peer = await builder.createPeer(kv);

      const db = await peer.createDatabase(spaceKey);
      const [obj1, obj2] = range(2, (n) => db.add(createTestObject(n, String(n))));
      await db.flush();
      await peer.host.updateIndexes();

      expect((await db.query().run()).objects.length).to.eq(2);
      const rootDocHandle = db.coreDatabase._automergeDocLoader.getSpaceRootDocHandle();
      rootDocHandle.change((doc: SpaceDoc) => {
        doc.links![obj1.id] = 'automerge:4hjTgo9zLNsfRTJiLcpPY8P4smy';
      });
      await db.flush();
      root = rootDocHandle.url;
      expectedObjectId = obj2.id;
    }

    {
      const peer = await builder.createPeer(kv);
      const db = await peer.openDatabase(spaceKey, root);
      const queryResult = (await db.query().run({ timeout: 200 })).objects;
      expect(queryResult.length).to.eq(1);
      expect(queryResult[0].id).to.eq(expectedObjectId);
    }
  });

  test('query immediately after delete works', async () => {
    const kv = createTestLevel();
    const spaceKey = PublicKey.random();

    const builder = new EchoTestBuilder();
    afterTest(() => builder.close());

    const peer = await builder.createPeer(kv);

    const db = await peer.createDatabase(spaceKey);
    const [obj1, obj2] = range(2, (n) => db.add(createTestObject(n, String(n))));
    await db.flush();
    await peer.host.updateIndexes();

    const obj2Core = getObjectCore(obj2);
    obj2Core.docHandle!.delete(); // Deleted handle access throws an exception.

    const queryResult = (await db.query().run()).objects;
    expect(queryResult.length).to.eq(1);
    expect(queryResult[0].id).to.eq(obj1.id);
  });
});

// TODO(wittjosiah): 2/3 of these tests fail. They reproduce issues that we want to fix.
describe.skip('Query updates', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;
  let objects: EchoReactiveObject<any>[];

  beforeAll(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase());

    objects = range(3).map((idx) => createTestObject(idx, 'red'));

    for (const object of objects) {
      db.add(object);
    }

    await db.flush();
  });

  afterAll(async () => {
    await builder.close();
  });

  test('fires only once when new objects are added', async () => {
    const query = db.query({ label: 'red' });
    expect(query.objects).to.have.length(3);
    let count = 0;
    query.subscribe(() => {
      count++;
      expect(query.objects).to.have.length(4);
    });
    db.add(createTestObject(3, 'red'));
    await sleep(10);
    expect(count).to.equal(1);
  });

  test('fires only once when objects are removed', async () => {
    const query = db.query({ label: 'red' });
    expect(query.objects).to.have.length(3);
    let count = 0;
    query.subscribe(() => {
      count++;
      expect(query.objects).to.have.length(2);
    });
    db.remove(objects[0]);
    await sleep(10);
    expect(count).to.equal(1);
  });

  test('does not fire on object updates', async () => {
    const query = db.query({ label: 'red' });
    expect(query.objects).to.have.length(3);
    query.subscribe(() => {
      throw new Error('Should not be called.');
    });
    objects[0].title = 'Task 0a';
    await sleep(10);
  });
});

test.skip('query with model filters', async () => {
  const testBuilder = new TestBuilder();
  const peer = await testBuilder.createPeer();

  const obj = peer.db.add(
    create(Expando, {
      title: 'title',
      description: create(Expando, { content: 'description' }),
    }),
  );

  expect(peer.db.query().objects).to.have.length(1);
  expect(peer.db.query().objects[0]).to.eq(obj);

  expect(peer.db.query(undefined, { models: ['*'] }).objects).to.have.length(2);
});

describe('Queries with types', () => {
  test('query by typename receives updates', async () => {
    const testBuilder = new TestBuilder();
    testBuilder.graph.schemaRegistry.addSchema([Contact]);
    const peer = await testBuilder.createPeer();
    const contact = peer.db.add(create(Contact, {}));
    const name = 'Rich Ivanov';

    const query = peer.db.query(Filter.typename('example.test.Contact'));
    const result = await query.run();
    expect(result.objects).to.have.length(1);
    expect(result.objects[0]).to.eq(contact);

    const nameUpdate = new Trigger();
    const anotherContactAdded = new Trigger();
    const unsub = query.subscribe(({ objects }) => {
      if (objects.some((obj) => obj.name === name)) {
        nameUpdate.wake();
      }
      if (objects.length === 2) {
        anotherContactAdded.wake();
      }
    });
    afterTest(() => unsub());

    contact.name = name;
    peer.db.add(create(Contact, {}));

    await asyncTimeout(nameUpdate.wait(), 1000);
    await asyncTimeout(anotherContactAdded.wait(), 1000);
  });

  test('`instanceof` operator works', async () => {
    const testBuilder = new TestBuilder();
    testBuilder.graph.schemaRegistry.addSchema([Contact]);
    const peer = await testBuilder.createPeer();
    const name = 'Rich Ivanov';
    const contact = create(Contact, { name });
    peer.db.add(contact);
    expect(contact instanceof Contact).to.be.true;

    // query
    {
      const contact = (await peer.db.query(Filter.schema(Contact)).run()).objects[0];
      expect(contact.name).to.eq(name);
      expect(contact instanceof Contact).to.be.true;
    }
  });
});

test('map over refs in query result', async () => {
  const testBuilder = new TestBuilder();
  const peer = await testBuilder.createPeer();

  const folder = peer.db.add(create(Expando, { name: 'folder', objects: [] as any[] }));
  const objects = range(3).map((idx) => createTestObject(idx));
  for (const object of objects) {
    folder.objects.push(object);
  }

  const queryResult = await peer.db.query({ name: 'folder' }).run();
  const result = queryResult.objects.flatMap(({ objects }) => objects);

  for (const i in objects) {
    expect(result[i]).to.eq(objects[i]);
  }
});
