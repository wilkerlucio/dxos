import { test } from 'vitest';

test('window global', () => {
  console.log({ window: globalThis.window });
});
