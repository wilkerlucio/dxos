//
// Copyright 2024 DXOS.org
//

import type * as S from '@effect/schema/Schema';

import {
  SchemaValidator,
  getMeta,
  getSchema,
  requireTypeReference,
  createReactiveProxy,
  getProxyHandlerSlot,
  isReactiveObject,
  DynamicEchoSchema,
} from '@dxos/echo-schema';
import type { EchoReactiveObject, ObjectMeta } from '@dxos/echo-schema';
import { compositeRuntime } from '@dxos/echo-signals/runtime';
import { invariant } from '@dxos/invariant';
import { ComplexMap, deepMapValues } from '@dxos/util';

import { DATA_NAMESPACE, EchoReactiveHandler, PROPERTY_ID, throwIfCustomClass } from './echo-handler';
import {
  type ObjectInternals,
  type ProxyTarget,
  symbolInternals,
  symbolNamespace,
  symbolPath,
} from './echo-proxy-target';
import { AutomergeObjectCore, type DecodedAutomergePrimaryValue } from '../automerge';

export const isEchoObject = (value: unknown): value is EchoReactiveObject<any> =>
  isReactiveObject(value) && getProxyHandlerSlot(value).handler instanceof EchoReactiveHandler;

export const createEchoObject = <T extends {}>(init: T): EchoReactiveObject<T> => {
  invariant(!isEchoObject(init));

  const schema = getSchema(init);
  if (schema != null) {
    validateSchema(schema);
  }
  validateInitialProps(init);

  if (isReactiveObject(init)) {
    const proxy = init as any;

    const slot = getProxyHandlerSlot(proxy);
    const meta = getProxyHandlerSlot<ObjectMeta>(getMeta(proxy)).target!;

    const core = new AutomergeObjectCore();
    core.rootProxy = proxy;

    slot.handler = EchoReactiveHandler.instance;
    const target = slot.target as ProxyTarget;

    target[symbolInternals] = {
      core,
      targetsMap: new ComplexMap((key) => JSON.stringify(key)),
      signal: compositeRuntime.createSignal(),
    };

    // TODO(dmaretskyi): Does this need to be disposed?
    core.updates.on(() => target[symbolInternals].signal.notifyWrite());

    target[symbolPath] = [];
    target[symbolNamespace] = DATA_NAMESPACE;
    slot.handler._proxyMap.set(target, proxy);

    initCore(core, target);
    slot.handler.init(target);

    saveTypeInAutomerge(target[symbolInternals], schema);
    if (meta && meta.keys.length > 0) {
      target[symbolInternals].core.setMeta(meta);
    }
    return proxy;
  } else {
    const core = new AutomergeObjectCore();
    const target: ProxyTarget = {
      [symbolInternals]: {
        core,
        targetsMap: new ComplexMap((key) => JSON.stringify(key)),
        signal: compositeRuntime.createSignal(),
      } satisfies ObjectInternals,
      [symbolPath]: [],
      [symbolNamespace]: DATA_NAMESPACE,
      ...(init as any),
    };

    // TODO(dmaretskyi): Does this need to be disposed?
    core.updates.on(() => target[symbolInternals].signal.notifyWrite());

    initCore(core, target);
    const proxy = createReactiveProxy<ProxyTarget>(target, EchoReactiveHandler.instance) as any;
    core.rootProxy = proxy;
    saveTypeInAutomerge(target[symbolInternals], schema);
    return proxy;
  }
};

const initCore = (core: AutomergeObjectCore, target: any) => {
  // Handle ID pre-generated by `create`.
  if (PROPERTY_ID in target) {
    target[symbolInternals].core.id = target[PROPERTY_ID];
    delete target[PROPERTY_ID];
  }
  core.initNewObject(linkAllNestedProperties(core, target));
};

export const initEchoReactiveObjectRootProxy = (core: AutomergeObjectCore) => {
  const target: ProxyTarget = {
    [symbolInternals]: {
      core,
      targetsMap: new ComplexMap((key) => JSON.stringify(key)),
      signal: compositeRuntime.createSignal(),
    },
    [symbolPath]: [],
    [symbolNamespace]: DATA_NAMESPACE,
  };

  // TODO(dmaretskyi): Does this need to be disposed?
  core.updates.on(() => target[symbolInternals].signal.notifyWrite());

  core.rootProxy = createReactiveProxy<ProxyTarget>(target, EchoReactiveHandler.instance) as any;
};

const validateSchema = (schema: S.Schema<any>) => {
  requireTypeReference(schema);
  SchemaValidator.validateSchema(schema);
};

const saveTypeInAutomerge = (internals: ObjectInternals, schema: S.Schema<any> | undefined) => {
  if (schema != null) {
    internals.core.setType(requireTypeReference(schema));
  }
};

const validateInitialProps = (target: any, seen: Set<object> = new Set()) => {
  if (seen.has(target)) {
    return;
  }
  seen.add(target);
  for (const key in target) {
    const value = target[key];
    if (value === undefined) {
      delete target[key];
    } else if (typeof value === 'object') {
      if (value instanceof DynamicEchoSchema) {
        target[key] = value.serializedSchema;
        validateInitialProps(value.serializedSchema, seen);
      } else {
        throwIfCustomClass(key, value);
        validateInitialProps(target[key], seen);
      }
    }
  }
};

const linkAllNestedProperties = (core: AutomergeObjectCore, data: any): DecodedAutomergePrimaryValue =>
  deepMapValues(data, (value, recurse) => {
    if (isReactiveObject(value) as boolean) {
      return core.linkObject(value);
    }
    return recurse(value);
  });
