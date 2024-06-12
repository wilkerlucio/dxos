//
// Copyright 2024 DXOS.org
//

import { expect } from 'chai';

import { encodeReference, type ObjectStructure, Reference } from '@dxos/echo-protocol';
import { afterTest, describe, test } from '@dxos/test';

import { IndexSchema } from './index-schema';

describe('IndexSchema', () => {
  const schemaURI = '@example.org/schema/Contact';
  const objects: Partial<ObjectStructure>[] = [
    {
      data: {
        name: 'John',
      },
      // Complaint structure with automerge storage
      system: {
        type: encodeReference(Reference.forType(schemaURI)),
      },
    },
    {
      data: {
        title: 'first document',
      },
      system: {
        type: encodeReference(Reference.forType('@example.org/schema/Document')),
      },
    },
  ];

  test('basic', async () => {
    const index = new IndexSchema();
    await index.open();
    afterTest(() => index.close());

    await Promise.all(objects.map((object, id) => index.update(String(id), object)));

    const ids = await index.find({ typenames: [schemaURI] });
    expect(ids.length).to.equal(1);
    expect(ids[0].id).to.equal('0');
  });

  test('update', async () => {
    const index = new IndexSchema();
    await index.open();
    afterTest(() => index.close());

    await Promise.all(objects.map((object, id) => index.update(String(id), object)));

    {
      const ids = await index.find({ typenames: [schemaURI] });
      expect(ids.length).to.equal(1);
      expect(ids[0].id).to.equal('0');
    }

    {
      const updated = await index.update('0', objects[0]);
      expect(updated).to.be.false;
    }

    {
      const updated = await index.update('0', {});
      expect(updated).to.be.true;
      const ids = await index.find({ typenames: [schemaURI] });
      expect(ids.length).to.equal(1);
      expect(ids[0].id).to.equal('0');
    }
  });

  test('remove', async () => {
    const index = new IndexSchema();
    await index.open();
    afterTest(() => index.close());

    await Promise.all(objects.map((object, id) => index.update(String(id), object)));

    {
      const ids = await index.find({ typenames: [schemaURI] });
      expect(ids.length).to.equal(1);
      expect(ids[0].id).to.equal('0');
    }

    await index.remove('0');

    {
      const ids = await index.find({ typenames: [schemaURI] });
      expect(ids.length).to.equal(0);
    }
  });

  test('serialize/load', async () => {
    const index = new IndexSchema();
    await index.open();
    afterTest(() => index.close());

    await Promise.all(objects.map((object, id) => index.update(String(id), object)));

    const serialized = await index.serialize();

    const loadedIndex = await IndexSchema.load({ serialized, identifier: index.identifier, indexKind: index.kind });

    {
      const ids = await loadedIndex.find({ typenames: [schemaURI] });
      expect(ids.length).to.equal(1);
      expect(ids[0].id).to.equal('0');
    }
  });

  test('`or` filter', async () => {
    const index = new IndexSchema();
    await index.open();
    afterTest(() => index.close());

    await Promise.all(objects.map((object, id) => index.update(String(id), object)));

    const ids = await index.find({ typenames: [schemaURI] });
    expect(ids.length).to.equal(1);
    expect(ids[0].id).to.equal('0');

    const ids2 = await index.find({ typenames: [schemaURI, '@example.org/schema/Document'] });
    expect(ids2.length).to.equal(2);
    expect(ids2[0].id).to.equal('0');
    expect(ids2[1].id).to.equal('1');
  });
});
