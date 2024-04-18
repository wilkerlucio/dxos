//
// Copyright 2024 DXOS.org
//

import { expect } from 'chai';
import { Level } from 'level';

import { PublicKey } from '@dxos/keys';
import { describe, test } from 'vitest';

import { createTestLevel } from '../testing';
import { type SubLevelDB } from './types';

describe('Level', () => {
  test('missing keys', async ({ onTestFinished }) => {
    const level = createTestLevel();
    await level.open();
    onTestFinished(async () => level.close());

    expect(() => level.get('missing')).to.throw;
  });

  test('data persistance after reload', async () => {
    const path = `/tmp/dxos-${PublicKey.random().toHex()}`;
    const level = new Level<string, string>(path);
    await level.open();

    const key = 'name';
    const value = 'Rich';
    {
      await level.put(key, value);
      expect(await level.get(key)).to.equal(value);
    }

    await level.close();

    {
      const level = new Level<string, string>(path);
      await level.open();
      expect(await level.get(key)).to.equal(value);
      await level.clear();
      expect(() => level.get(key)).to.throw;
    }
  });

  test('batch different sublevels', async ({ onTestFinished }) => {
    const level = createTestLevel();
    await level.open();
    onTestFinished(async () => level.close());

    const first: SubLevelDB = level.sublevel('first');
    const second: SubLevelDB = level.sublevel('second');

    const batch = first.batch();

    const key = 'key';
    const value = 'first-level-value';
    batch.put(key, value, { sublevel: second });
    await batch.write();

    expect(() => first.get(key)).to.throw;
    expect(await level.sublevel('second').get(key)).to.equal(value);
    expect(await second.get(key)).to.equal(value);
    expect(await second.iterator().all()).to.deep.equal([[key, value]]);
  });
});
