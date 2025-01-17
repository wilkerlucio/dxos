//
// Copyright 2024 DXOS.org
//

import type { EchoReactiveObject } from '@dxos/echo-schema';
import { type QueryOptions } from '@dxos/protocols/proto/dxos/echo/filter';

import type { Filter$, FilterSource } from './filter';
import { type Query } from './query';

/**
 * `query` API function declaration.
 */
export interface QueryFn {
  (): Query;
  <F extends Filter$.Any>(filter: F, options?: QueryOptions | undefined): Query<EchoReactiveObject<Filter$.Object<F>>>;
  (filter?: FilterSource | undefined, options?: QueryOptions | undefined): Query<EchoReactiveObject<any>>;
}
