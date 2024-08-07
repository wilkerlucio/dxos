//
// Copyright 2023 DXOS.org
//

import { useEffect, useMemo, useState } from 'react';

import { type EchoReactiveObject } from '@dxos/echo-schema';
import { log } from '@dxos/log';
import { createDocAccessor } from '@dxos/react-client/echo';

import { AutomergeStoreAdapter, type StoreAdapter } from './adapter';

export const useStoreAdapter = (object?: EchoReactiveObject<any>, options = { timeout: 250 }): StoreAdapter => {
  const adapter = useMemo(() => new AutomergeStoreAdapter(options), []);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    if (!object) {
      return;
    }

    try {
      adapter.open(createDocAccessor(object, ['content']));
      forceUpdate({});
    } catch (err) {
      // TODO(burdon): User error handling for corrupted data.
      log.catch(err);
    }

    return () => {
      adapter.close();
    };
  }, [object]);

  return adapter;
};
