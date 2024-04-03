//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';
import { inspect, type InspectOptionsStylized } from 'node:util';

import { Reference } from '@dxos/echo-db';
import { compositeRuntime } from '@dxos/echo-signals/runtime';
import { invariant } from '@dxos/invariant';
import { assignDeep, ComplexMap, defaultMap, getDeep } from '@dxos/util';

import { DynamicEchoSchema } from './dynamic/dynamic-schema';
import { StoredEchoSchema } from './dynamic/stored-schema';
import {
  createReactiveProxy,
  getProxyHandlerSlot,
  isReactiveProxy,
  symbolIsProxy,
  type ReactiveHandler,
} from './proxy';
import { getSchema, getTypeReference, type EchoReactiveObject, EchoReactiveHandler } from './reactive';
import { getTargetMeta } from './reactive-meta-handler';
import { SchemaValidator } from './schema-validator';
import { AutomergeObjectCore, META_NAMESPACE } from '../automerge/automerge-object-core';
import { type KeyPath } from '../automerge/key-path';
import { encodeReference } from '../automerge/types';
import { data, type ObjectMeta } from '../object';
import { defineHiddenProperty } from '../util/property';

const symbolPath = Symbol('path');
const symbolNamespace = Symbol('namespace');
const symbolHandler = Symbol('handler');

type ProxyTarget = {
  [symbolPath]: KeyPath;
  [symbolNamespace]: string;
  [symbolHandler]?: EchoReactiveHandler;
} & ({ [key: keyof any]: any } | any[]);

const PROPERTY_ID = 'id';

const DATA_NAMESPACE = 'data';

/**
 * Shared for all targets within one ECHO object.
 */
export class EchoReactiveHandlerImpl extends EchoReactiveHandler implements ReactiveHandler<ProxyTarget> {
  _proxyMap = new WeakMap<object, any>();

  _objectCore = new AutomergeObjectCore();

  private _targetsMap = new ComplexMap<KeyPath, ProxyTarget>((key) => JSON.stringify(key));

  _init(target: ProxyTarget): void {
    invariant(!(target as any)[symbolIsProxy]);
    invariant(Array.isArray(target[symbolPath]));

    // Handle ID pre-generated by `E.object`.
    if (PROPERTY_ID in target) {
      this._objectCore.id = target[PROPERTY_ID];
      delete target[PROPERTY_ID];
    }

    if (target[symbolPath].length === 0) {
      this.validateInitialProps(target);
      if (this._objectCore.database == null) {
        this._objectCore.initNewObject(target);
      }
    }

    // Clear extra keys from objects
    if (!Array.isArray(target)) {
      for (const key in target) {
        if (typeof key !== 'symbol') {
          delete (target as any)[key];
        }
      }
    }

    defineHiddenProperty(target, symbolHandler, this);
    if (inspect.custom) {
      defineHiddenProperty(target, inspect.custom, this._inspect.bind(target));
    }
  }

  private validateInitialProps(target: any) {
    for (const key in target) {
      const value = target[key];
      if (value === undefined) {
        delete target[key];
      } else if (typeof value === 'object') {
        if (value instanceof DynamicEchoSchema) {
          target[key] = value.serializedSchema;
        } else {
          throwIfCustomClass(key, value);
        }
        this.validateInitialProps(target[key]);
      }
    }
  }

  ownKeys(target: ProxyTarget): ArrayLike<string | symbol> {
    const { value } = this.getDecodedValueAtPath(target);
    const keys = typeof value === 'object' ? Reflect.ownKeys(value) : [];
    if (isRootDataObject(target)) {
      keys.push(PROPERTY_ID);
    }
    return keys;
  }

  getOwnPropertyDescriptor(target: ProxyTarget, p: string | symbol): PropertyDescriptor | undefined {
    const { value } = this.getDecodedValueAtPath(target);
    if (isRootDataObject(target) && p === PROPERTY_ID) {
      return { enumerable: true, configurable: true, writable: false };
    }
    return typeof value === 'object' ? Reflect.getOwnPropertyDescriptor(value, p) : undefined;
  }

  get(target: ProxyTarget, prop: string | symbol, receiver: any): any {
    invariant(Array.isArray(target[symbolPath]));

    this._objectCore.signal.notifyRead();

    if (isRootDataObject(target)) {
      const handled = this._handleRootObjectProperty(target, prop);
      if (handled != null) {
        return handled;
      }
    }

    if (typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }

    if (target instanceof EchoArrayTwoPointO) {
      return this._arrayGet(target, prop);
    }

    const decodedValueAtPath = this.getDecodedValueAtPath(target, prop);
    return this._wrapInProxyIfRequired(decodedValueAtPath);
  }

  private _handleRootObjectProperty(target: ProxyTarget, prop: string | symbol) {
    if (prop === data) {
      return this._toJSON(target);
    }
    if (prop === 'toJSON') {
      return () => this._toJSON(target);
    }
    if (prop === PROPERTY_ID) {
      return this._objectCore.id;
    }
    return null;
  }

  private _wrapInProxyIfRequired(decodedValueAtPath: DecodedValueAtPath) {
    const { value: decoded, dataPath, namespace } = decodedValueAtPath;
    if (decoded == null) {
      return decoded;
    }
    if (decoded[symbolIsProxy]) {
      return this._handleStoredSchema(decoded);
    }
    if (decoded instanceof Reference) {
      return this._handleStoredSchema(this._objectCore.lookupLink(decoded));
    }
    if (Array.isArray(decoded)) {
      const target = defaultMap(this._targetsMap, dataPath, (): ProxyTarget => {
        const array = new EchoArrayTwoPointO();
        array[symbolPath] = dataPath;
        array[symbolNamespace] = namespace;
        array[symbolHandler] = this;
        return array;
      });
      return createReactiveProxy(target, this);
    }
    if (typeof decoded === 'object') {
      // TODO(dmaretskyi): Materialize properties for easier debugging.
      const target = defaultMap(
        this._targetsMap,
        dataPath,
        (): ProxyTarget => ({ [symbolPath]: dataPath, [symbolNamespace]: namespace }),
      );
      return createReactiveProxy(target, this);
    }
    return decoded;
  }

  private _handleStoredSchema(object: any): any {
    if (object != null && object instanceof StoredEchoSchema) {
      return this._objectCore.database?._dbApi.schemaRegistry.register(object);
    }
    return object;
  }

  has(target: ProxyTarget, p: string | symbol): boolean {
    if (target instanceof EchoArrayTwoPointO) {
      return this._arrayHas(target, p);
    }
    const { value } = this.getDecodedValueAtPath(target);
    return typeof value === 'object' ? Reflect.has(value, p) : false;
  }

  defineProperty(target: ProxyTarget, property: string | symbol, attributes: PropertyDescriptor): boolean {
    return this.set(target, property, attributes.value, target);
  }

  private getDecodedValueAtPath(target: ProxyTarget, prop?: string): DecodedValueAtPath {
    const dataPath = [...target[symbolPath]];
    if (prop != null) {
      dataPath.push(prop);
    }
    const fullPath = [getNamespace(target), ...dataPath];
    const value = this._objectCore.get(fullPath);
    return { namespace: getNamespace(target), value: this._objectCore.decode(value), dataPath };
  }

  private _arrayGet(target: ProxyTarget, prop: string) {
    invariant(target instanceof EchoArrayTwoPointO);
    if (prop === 'constructor') {
      return Array.prototype.constructor;
    }
    if (prop !== 'length' && isNaN(parseInt(prop))) {
      return Reflect.get(target, prop);
    }
    const decodedValueAtPath = this.getDecodedValueAtPath(target, prop);
    return this._wrapInProxyIfRequired(decodedValueAtPath);
  }

  private _arrayHas(target: ProxyTarget, prop: string | symbol) {
    invariant(target instanceof EchoArrayTwoPointO);
    if (typeof prop === 'string') {
      const parsedIndex = parseInt(prop);
      const { value: length } = this.getDecodedValueAtPath(target, 'length');
      invariant(typeof length === 'number');
      if (!isNaN(parsedIndex)) {
        return parsedIndex < length;
      }
    }
    return Reflect.has(target, prop);
  }

  set(target: ProxyTarget, prop: string | symbol, value: any, receiver: any): boolean {
    invariant(Array.isArray(target[symbolPath]));
    invariant(typeof prop === 'string');

    if (target instanceof EchoArrayTwoPointO && prop === 'length') {
      this._arraySetLength(target, target[symbolPath], value);
      return true;
    }

    const validatedValue = this.validateValue(target, [...target[symbolPath], prop], value);
    const fullPath = [getNamespace(target), ...target[symbolPath], prop];

    if (validatedValue === undefined) {
      this._objectCore.delete(fullPath);
    } else if (validatedValue !== null && validatedValue[symbolHandler] instanceof EchoReactiveHandlerImpl) {
      const link = this._linkReactiveHandler(validatedValue, validatedValue[symbolHandler]);
      this._objectCore.set(fullPath, encodeReference(link));
    } else {
      const encoded = this._objectCore.encode(validatedValue, { removeUndefined: true });
      this._objectCore.set(fullPath, encoded);
    }

    return true;
  }

  private _linkReactiveHandler(proxy: any, handler: EchoReactiveHandlerImpl): Reference {
    const itemId = handler._objectCore.id;
    if (this._objectCore.database) {
      const anotherDb = handler._objectCore.database;
      if (!anotherDb) {
        this._objectCore.database.add(proxy);
        return new Reference(itemId);
      } else {
        if (anotherDb !== this._objectCore.database) {
          return new Reference(itemId, undefined, anotherDb.spaceKey.toHex());
        } else {
          return new Reference(itemId);
        }
      }
    } else {
      invariant(this._objectCore.linkCache);
      this._objectCore.linkCache.set(itemId, proxy);
      return new Reference(itemId);
    }
  }

  private validateValue(target: any, path: KeyPath, value: any): any {
    invariant(path.length > 0);
    throwIfCustomClass(path[path.length - 1], value);
    const rootObjectSchema = this.getSchema();
    if (rootObjectSchema == null) {
      const typeReference = this._objectCore.getType();
      if (typeReference) {
        throw new Error(`Schema not found in schema registry: ${typeReference.itemId}`);
      }
      return value;
    }
    // DynamicEchoSchema is a utility-wrapper around the object we actually store in automerge, unwrap it
    const unwrappedValue = value instanceof DynamicEchoSchema ? value.serializedSchema : value;
    const propertySchema = SchemaValidator.getPropertySchema(rootObjectSchema, path, (path) =>
      this._objectCore.getDecoded([getNamespace(target), ...path]),
    );
    if (propertySchema == null) {
      return unwrappedValue;
    }
    const _ = S.asserts(propertySchema)(unwrappedValue);
    return unwrappedValue;
  }

  getSchema(): S.Schema<any> | undefined {
    // TODO: make reactive
    invariant(this._objectCore.database, 'EchoHandler used without database');
    const typeReference = this._objectCore.getType();
    if (typeReference == null) {
      return undefined;
    }
    const staticSchema = this._objectCore.database.graph.types.getEffectSchema(typeReference.itemId);
    if (staticSchema != null) {
      return staticSchema;
    }
    return this._objectCore.database._dbApi.schemaRegistry.getById(typeReference.itemId);
  }

  arrayPush(target: any, path: KeyPath, ...items: any[]): number {
    this._validateForArray(target, path, items, target.length);

    const fullPath = this._getPropertyMountPath(target, path);

    const encodedItems = this._encodeForArray(items);

    let newLength: number = -1;
    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      newLength = array.push(...encodedItems);
    });
    invariant(newLength !== -1);

    return newLength;
  }

  arrayPop(target: any, path: KeyPath): any {
    const fullPath = this._getPropertyMountPath(target, path);

    let returnValue: any | undefined;
    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      returnValue = array.pop();
    });

    return returnValue;
  }

  arrayShift(target: any, path: KeyPath): any {
    const fullPath = this._getPropertyMountPath(target, path);

    let returnValue: any | undefined;
    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      returnValue = array.shift();
    });

    return returnValue;
  }

  arrayUnshift(target: any, path: KeyPath, ...items: any[]): number {
    this._validateForArray(target, path, items, 0);

    const fullPath = this._getPropertyMountPath(target, path);

    const encodedItems = this._encodeForArray(items);

    let newLength: number = -1;
    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      newLength = array.unshift(...encodedItems);
    });
    invariant(newLength !== -1);

    return newLength;
  }

  arraySplice(target: any, path: KeyPath, start: number, deleteCount?: number, ...items: any[]): any[] {
    this._validateForArray(target, path, items, start);

    const fullPath = this._getPropertyMountPath(target, path);

    const encodedItems = this._encodeForArray(items);

    let deletedElements: any[] | undefined;
    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      if (deleteCount != null) {
        deletedElements = array.splice(start, deleteCount, ...encodedItems);
      } else {
        deletedElements = array.splice(start);
      }
    });
    invariant(deletedElements);

    return deletedElements;
  }

  arraySort(target: any, path: KeyPath, compareFn?: (v1: any, v2: any) => number): any[] {
    const fullPath = this._getPropertyMountPath(target, path);

    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      const sortedArray = [...array].sort(compareFn);
      assignDeep(doc, fullPath, sortedArray);
    });

    return target;
  }

  arrayReverse(target: any, path: KeyPath): any[] {
    const fullPath = this._getPropertyMountPath(target, path);

    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      const reversedArray = [...array].reverse();
      assignDeep(doc, fullPath, reversedArray);
    });

    return target;
  }

  getMeta(): ObjectMeta {
    const target: any = { [symbolPath]: [], [symbolNamespace]: META_NAMESPACE };
    return createReactiveProxy(target, this) as ObjectMeta;
  }

  private _arraySetLength(target: any, path: KeyPath, newLength: number) {
    if (newLength < 0) {
      throw new RangeError('Invalid array length');
    }
    const fullPath = this._getPropertyMountPath(target, path);

    this._objectCore.change((doc) => {
      const array = getDeep(doc, fullPath);
      invariant(Array.isArray(array));
      const trimmedArray = [...array];
      trimmedArray.length = newLength;
      assignDeep(doc, fullPath, trimmedArray);
    });
  }

  private _validateForArray(target: any, path: KeyPath, items: any[], start: number) {
    let index = start;
    for (const item of items) {
      this.validateValue(target, [...path, String(index++)], item);
    }
  }

  private _encodeForArray(items: any[] | undefined): any[] {
    return items?.map((value) => this._objectCore.encode(value, { removeUndefined: true })) ?? [];
  }

  private _getPropertyMountPath(target: any, path: KeyPath): KeyPath {
    return [...this._objectCore.mountPath, getNamespace(target), ...path];
  }

  // Will be bound to the proxy target.
  _inspect = function (
    this: ProxyTarget,
    _: number,
    options: InspectOptionsStylized,
    inspectFn: (value: any, options?: InspectOptionsStylized) => string,
  ) {
    const handler = this[symbolHandler] as EchoReactiveHandlerImpl;
    const isTyped = !!handler._objectCore.getType();
    const proxy = handler.getReified(this);
    invariant(proxy, '_proxyMap corrupted');
    const reified = { ...proxy }; // Will call proxy methods and construct a plain JS object.
    return `${isTyped ? 'Typed' : ''}EchoObject ${inspectFn(reified, {
      ...options,
      compact: true,
      showHidden: false,
      customInspect: false,
    })}`;
  };

  private _toJSON(target: any): any {
    const typeRef = this._objectCore.getType();
    const reified = this.getReified(target);
    delete reified.id;
    return {
      '@type': typeRef ? encodeReference(typeRef) : undefined,
      ...(this._objectCore.isDeleted() ? { '@deleted': true } : {}),
      '@meta': { ...this.getMeta() },
      '@id': this._objectCore.id,
      ...reified,
    };
  }

  private getReified(target: any) {
    const proxy = this._proxyMap.get(target);
    invariant(proxy, '_proxyMap corrupted');
    // Will call proxy methods and construct a plain JS object.
    return { ...proxy };
  }
}

/**
 * Extends the native array with methods overrides for automerge.
 */
// TODO(dmaretskyi): Rename once the original AutomergeArray gets deleted.
class EchoArrayTwoPointO<T> extends Array<T> {
  static get [Symbol.species]() {
    return Array;
  }

  // Will be initialize when the proxy is created.
  [symbolPath]: KeyPath = null as any;
  [symbolNamespace]: string = null as any;
  [symbolHandler]: EchoReactiveHandler = null as any;

  static {
    /**
     * These methods will trigger proxy traps like `set` and `defineProperty` and emit signal notifications.
     * We wrap them in a batch to avoid unnecessary signal notifications.
     */
    const BATCHED_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'] as const;

    for (const method of BATCHED_METHODS) {
      const handlerMethodName = `array${method.slice(0, 1).toUpperCase()}${method.slice(1)}`;

      Object.defineProperty(this.prototype, method, {
        enumerable: false,
        value: function (this: EchoArrayTwoPointO<any>, ...args: any[]) {
          let result!: any;
          compositeRuntime.batch(() => {
            const handler = this[symbolHandler] as any;
            result = (handler[handlerMethodName] as any).apply(handler, [this, this[symbolPath], ...args]);
          });
          return result;
        },
      });
    }
  }
}

const throwIfCustomClass = (prop: KeyPath[number], value: any) => {
  if (value == null || Array.isArray(value)) {
    return;
  }
  if (value instanceof DynamicEchoSchema) {
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (typeof value === 'object' && proto !== Object.prototype) {
    throw new Error(`class instances are not supported: setting ${proto} on ${String(prop)}`);
  }
};

// TODO(dmaretskyi): Read schema from typed in-memory objects.
export const createEchoReactiveObject = <T extends {}>(init: T): EchoReactiveObject<T> => {
  const schema = getSchema(init);
  if (schema != null) {
    validateSchema(schema);
  }

  if (isReactiveProxy(init)) {
    const proxy = init as any;

    const slot = getProxyHandlerSlot(proxy);
    const meta = getProxyHandlerSlot<ObjectMeta>(getTargetMeta(slot.target)).target!;

    const echoHandler = new EchoReactiveHandlerImpl();
    echoHandler._objectCore.rootProxy = proxy;

    slot.handler = echoHandler;
    const target = slot.target as ProxyTarget;
    target[symbolPath] = [];
    target[symbolNamespace] = DATA_NAMESPACE;
    slot.handler._proxyMap.set(target, proxy);
    slot.handler._init(target);
    saveTypeInAutomerge(echoHandler, schema);
    if (meta.keys.length > 0) {
      echoHandler._objectCore.setMeta(meta);
    }
    return proxy;
  } else {
    const target = { [symbolPath]: [], [symbolNamespace]: DATA_NAMESPACE, ...(init as any) };
    const handler = new EchoReactiveHandlerImpl();
    const proxy = createReactiveProxy<ProxyTarget>(target, handler) as any;
    handler._objectCore.rootProxy = proxy;
    saveTypeInAutomerge(handler, schema);
    return proxy;
  }
};

export const initEchoReactiveObjectRootProxy = (core: AutomergeObjectCore) => {
  const target = { [symbolPath]: [], [symbolNamespace]: DATA_NAMESPACE };
  const handler = new EchoReactiveHandlerImpl();
  handler._objectCore = core;
  handler._objectCore.rootProxy = createReactiveProxy<ProxyTarget>(target, handler) as any;
};

const validateSchema = (schema: S.Schema<any>) => {
  getSchemaTypeRefOrThrow(schema);
  SchemaValidator.validateSchema(schema);
};

const saveTypeInAutomerge = (handler: EchoReactiveHandlerImpl, schema: S.Schema<any> | undefined) => {
  if (schema != null) {
    handler._objectCore.setType(getSchemaTypeRefOrThrow(schema));
  }
};

export const getSchemaTypeRefOrThrow = (schema: S.Schema<any>): Reference => {
  const typeReference = getTypeReference(schema);
  if (typeReference == null) {
    throw new Error(
      'EchoObject schema must have a valid annotation: MyTypeSchema.pipe(R.echoObject("MyType", "1.0.0"))',
    );
  }
  return typeReference;
};

const getNamespace = (target: any): string => target[symbolNamespace];

const isRootDataObject = (target: any) => {
  const path = target[symbolPath];
  if (!Array.isArray(path) || path.length > 0) {
    return false;
  }
  return getNamespace(target) === DATA_NAMESPACE;
};

interface DecodedValueAtPath {
  value: any;
  namespace: string;
  dataPath: KeyPath;
}
