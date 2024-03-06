//
// Copyright 2023 DXOS.org
//

import { Reference } from '@dxos/document-model';
import { invariant } from '@dxos/invariant';
import { type PublicKey } from '@dxos/keys';
import { QueryOptions, type Filter as FilterProto } from '@dxos/protocols/proto/dxos/echo/filter';

import { getAutomergeObjectCore } from '../automerge';
import {
  getDatabaseFromObject,
  isTypedObject,
  type EchoObject,
  type Expando,
  type TypedObject,
  immutable,
  OpaqueEchoObject,
} from '../object';
import { getReferenceWithSpaceKey } from '../object';
import { type Schema } from '../proto';
import get from 'lodash.get';
import { isReactiveProxy } from '../effect/proxy';

export const hasType =
  <T extends TypedObject>(schema: Schema) =>
  (object: TypedObject | undefined): object is T =>
    object?.__typename === schema.typename;

// TODO(burdon): Operators (EQ, NE, GT, LT, IN, etc.)
export type PropertyFilter = Record<string, any>;

export type OperatorFilter<T extends EchoObject> = (object: T) => boolean;

export type FilterSource<T extends EchoObject = EchoObject> = PropertyFilter | OperatorFilter<T> | Filter<T> | string;

// TODO(burdon): Remove class.
// TODO(burdon): Disambiguate if multiple are defined (i.e., AND/OR).
export type FilterParams<T extends EchoObject> = {
  type?: Reference;
  properties?: Record<string, any>;
  text?: string;
  predicate?: OperatorFilter<T>;
  not?: boolean;
  and?: Filter[];
  or?: Filter[];
};

export class Filter<T extends EchoObject = EchoObject> {
  static from<T extends TypedObject>(source?: FilterSource<T>, options?: QueryOptions): Filter<T> {
    if (source === undefined || source === null) {
      return new Filter({}, options);
    } else if (source instanceof Filter) {
      return new Filter(source, options);
    } else if (typeof source === 'function') {
      return new Filter(
        {
          predicate: source as any,
        },
        options,
      );
    } else if (typeof source === 'string') {
      return new Filter(
        {
          text: source,
        },
        options,
      );
    } else if (Array.isArray(source)) {
      return new Filter(
        {
          and: source.map((sourceItem) => Filter.from(sourceItem)),
        },
        options,
      );
    } else if (typeof source === 'object') {
      return new Filter(
        {
          properties: source,
        },
        options,
      );
    } else {
      throw new Error(`Invalid filter source: ${source}`);
    }
  }

  static schema(schema: Schema): Filter<Expando> {
    const ref = getReferenceWithSpaceKey(schema);
    invariant(ref, 'Invalid schema; check persisted in the database.');
    return new Filter({
      type: ref,
    });
  }

  static typename(typename: string, filter?: Record<string, any> | OperatorFilter<any>): Filter<any> {
    const type = Reference.fromLegacyTypename(typename);

    switch (typeof filter) {
      case 'function':
        return new Filter({ type, predicate: filter as any });
      case 'object':
        return new Filter({ type, properties: filter });
      case 'undefined':
        return new Filter({ type });
      default:
        throw new TypeError('Invalid filter.');
    }
  }

  static not<T extends EchoObject>(source: Filter<T>): Filter<T> {
    return new Filter({ ...source, not: !source.not }, source.options);
  }

  static and<T extends EchoObject>(...filters: FilterSource<T>[]): Filter<T> {
    return new Filter({
      and: filters.map((filter) => Filter.from(filter)),
    });
  }

  static or<T extends EchoObject>(...filters: FilterSource<T>[]): Filter<T> {
    return new Filter({
      or: filters.map((filter) => Filter.from(filter)),
    });
  }

  static fromProto(proto: FilterProto): Filter {
    // NOTE(mykola): Filter expects options empty arrays to be undefined.
    const options: QueryOptions = {
      ...proto.options,
      spaces: proto.options?.spaces?.length === 0 ? undefined : proto.options?.spaces,
      models: proto.options?.models?.length === 0 ? undefined : proto.options?.models,
    };
    return new Filter(
      {
        type: proto.type && Reference.fromValue(proto.type),
        properties: proto.properties,
        text: proto.text,
        not: proto.not,
        and: proto.and?.map((filter) => Filter.fromProto(filter)),
        or: proto.or?.map((filter) => Filter.fromProto(filter)),
      },
      options,
    );
  }

  // TODO(burdon): Make plain immutable object (unless generics are important).
  // TODO(burdon): Split into protobuf serializable and non-serializable (operator) predicates.

  public readonly type?: Reference;
  public readonly properties?: Record<string, any>;
  public readonly text?: string;
  public readonly predicate?: OperatorFilter<any>;
  public readonly not: boolean;
  public readonly and: Filter[];
  public readonly or: Filter[];
  public readonly options: QueryOptions = {};

  protected constructor(params: FilterParams<T>, options: QueryOptions = {}) {
    this.type = params.type;
    this.properties = params.properties;
    this.text = params.text;
    this.predicate = params.predicate;
    this.not = params.not ?? false;
    this.and = params.and ?? [];
    this.or = params.or ?? [];
    this.options = options;
  }

  // TODO(burdon): toJSON.

  get spaceKeys(): PublicKey[] | undefined {
    return this.options.spaces;
  }

  toProto(): FilterProto {
    return {
      properties: this.properties,
      type: this.type?.encode(),
      text: this.text,
      not: this.not,
      and: this.and.map((filter) => filter.toProto()),
      or: this.or.map((filter) => filter.toProto()),
      options: this.options,
    };
  }
}

// TODO(burdon): Move logic into Filter.
export const filterMatch = (filter: Filter, object: OpaqueEchoObject | undefined): boolean => {
  if (!object) {
    return false;
  }
  const result = filterMatchInner(filter, object);
  return filter.not ? !result : result;
};

const filterMatchInner = (filter: Filter, object: OpaqueEchoObject): boolean => {
  invariant(isTypedObject(object) || isReactiveProxy(object));
  const core = getAutomergeObjectCore(object);

  const deleted = filter.options.deleted ?? QueryOptions.ShowDeletedOption.HIDE_DELETED;
  if (core.isDeleted()) {
    if (deleted === QueryOptions.ShowDeletedOption.HIDE_DELETED) {
      return false;
    }
  } else {
    if (deleted === QueryOptions.ShowDeletedOption.SHOW_DELETED_ONLY) {
      return false;
    }
  }

  if (filter.or.length) {
    for (const orFilter of filter.or) {
      if (filterMatch(orFilter, object)) {
        return true;
      }
    }

    return false;
  }

  if (filter.type) {
    const type = core.getType();

    const dynamicSchema = isTypedObject(core.rootProxy) ? core.rootProxy.__schema : undefined;

    // Separate branch for objects with dynamic schema and typename filters.
    // TODO(dmaretskyi): Better way to check if schema is dynamic.
    if (filter.type.protocol === 'protobuf' && dynamicSchema && !dynamicSchema[immutable]) {
      if (dynamicSchema.typename !== filter.type.itemId) {
        return false;
      }
    } else {
      if (!type) {
        return false;
      }

      // TODO(burdon): Comment.
      if (!compareType(filter.type, type, core.database?.spaceKey)) {
        return false;
      }
    }
  }

  if (filter.properties) {
    for (const key in filter.properties) {
      invariant(key !== '@type');
      const value = filter.properties[key];
      if ((object as any)[key] !== value) {
        return false;
      }
    }
  }

  if (filter.text !== undefined) {
    if (!isTypedObject(object)) {
      return false;
    }

    const text = filter.text.toLowerCase();
    if (!JSON.stringify(object.toJSON()).toLowerCase().includes(text)) {
      return false;
    }
  }

  if (filter.predicate && !filter.predicate(object)) {
    return false;
  }

  for (const andFilter of filter.and) {
    if (!filterMatch(andFilter, object)) {
      return false;
    }
  }

  return true;
};

// Type comparison is a bit weird due to backwards compatibility requirements.
// TODO(dmaretskyi): Deprecate `protobuf` protocol to clean this up.
export const compareType = (expected: Reference, actual: Reference, spaceKey?: PublicKey) => {
  const host = actual.protocol !== 'protobuf' ? actual?.host ?? spaceKey?.toHex() : actual.host ?? 'dxos.org';

  if (
    actual.itemId !== expected.itemId ||
    actual.protocol !== expected.protocol ||
    (host !== expected.host && actual.host !== expected.host)
  ) {
    return false;
  } else {
    return true;
  }
};
