//
// Copyright 2024 DXOS.org
//

import * as AST from '@effect/schema/AST';
import * as S from '@effect/schema/Schema';
import { pipe } from 'effect';
import * as Option from 'effect/Option';
import { type Simplify, type Mutable } from 'effect/Types';

import { Reference } from '@dxos/document-model';
import { invariant } from '@dxos/invariant';
import { PublicKey } from '@dxos/keys';

import { EchoReactiveHandler } from './echo-handler';
import {
  type ReactiveHandler,
  createReactiveProxy,
  isValidProxyTarget,
  isReactiveProxy,
  getProxyHandlerSlot,
} from './proxy';
import { SchemaValidator, symbolSchema, validateIdNotPresentOnSchema } from './schema-validator';
import { TypedReactiveHandler } from './typed-handler';
import { UntypedReactiveHandler } from './untyped-handler';
import { data, type ObjectMeta } from '../object';

export const IndexAnnotation = Symbol.for('@dxos/schema/annotation/Index');
export const getIndexAnnotation = AST.getAnnotation<boolean>(IndexAnnotation);

export const EchoObjectAnnotationId = Symbol.for('@dxos/echo-schema/annotation/NamedSchema');
export type EchoObjectAnnotation = {
  typename: string;
  version: string;
};

// TODO(dmaretskyi): Add `id` field to the schema type.
export const echoObject =
  (typename: string, version: string) =>
  <A, I, R>(self: S.Schema<A, I, R>): S.Schema<Simplify<Identifiable & Mutable<A>>> => {
    if (!AST.isTypeLiteral(self.ast)) {
      throw new Error('echoObject can only be applied to S.struct instances.');
    }

    validateIdNotPresentOnSchema(self);

    const schemaWithId = S.extend(S.mutable(self), S.struct({ id: S.string }));

    return S.make(AST.setAnnotation(schemaWithId.ast, EchoObjectAnnotationId, { typename, version })) as S.Schema<
      Simplify<Identifiable & Mutable<A>>
    >;
  };

export const AnyEchoObject = S.struct({}).pipe(echoObject('Any', '0.1.0'));

/**
 * Has `id`.
 */
export interface Identifiable {
  readonly id: string;
}

type ExcludeId<T> = Omit<T, 'id'>;

// TODO(dmaretskyi): UUID v8.
const generateId = () => PublicKey.random().toHex();

export type ObjectType<T extends S.Schema<any>> = Identifiable & Mutable<S.Schema.To<T>>;

export const getEchoObjectAnnotation = (schema: S.Schema<any>) =>
  pipe(
    AST.getAnnotation<EchoObjectAnnotation>(EchoObjectAnnotationId)(schema.ast),
    Option.getOrElse(() => undefined),
  );

// https://github.com/Effect-TS/effect/blob/main/packages/schema/README.md#introduction
// https://effect-ts.github.io/effect/schema/Schema.ts.html

/**
 * Reactive object.
 * Accessing properties triggers signal semantics.
 */
// This type doesn't change the shape of the object, it is rather used as an indicator that the object is reactive.
export type ReactiveObject<T> = { [K in keyof T]: T[K] } & { [data]?(): any };

export type EchoReactiveObject<T> = ReactiveObject<T> & { id: string };

export const isEchoReactiveObject = (value: unknown): value is EchoReactiveObject<any> =>
  isReactiveProxy(value) && getProxyHandlerSlot(value).handler instanceof EchoReactiveHandler;

/**
 * Creates a reactive object from a plain Javascript object.
 * Optionally provides a TS-effect schema.
 */
// TODO(burdon): Option to return mutable object.
// TODO(dmaretskyi): Deep mutability.
export const object: {
  <T extends {}>(obj: T): ReactiveObject<Mutable<T>>;
  <T extends {}>(schema: S.Schema<T>, obj: ExcludeId<T>): ReactiveObject<Mutable<T>>;
} = <T extends {}>(schemaOrObj: S.Schema<T> | T, obj?: ExcludeId<T>): ReactiveObject<Mutable<T>> => {
  if (obj) {
    if (!isValidProxyTarget(obj)) {
      throw new Error('Value cannot be made into a reactive object.');
    }
    const schema: S.Schema<T> = schemaOrObj as S.Schema<T>;
    const echoAnnotation = getEchoObjectAnnotation(schema);
    if (echoAnnotation) {
      if ('id' in obj) {
        throw new Error(
          'Provided object already has an `id` field. `id` field is reserved and will be automatically generated.',
        );
      }

      (obj as any).id = generateId();
    }

    SchemaValidator.prepareTarget(obj as T, schema);
    return createReactiveProxy(obj, new TypedReactiveHandler()) as ReactiveObject<Mutable<T>>;
  } else {
    if (!isValidProxyTarget(schemaOrObj)) {
      throw new Error('Value cannot be made into a reactive object.');
    }

    // Untyped.
    return createReactiveProxy(
      schemaOrObj as T,
      UntypedReactiveHandler.instance as ReactiveHandler<any>,
    ) as ReactiveObject<Mutable<T>>;
  }
};

export const ReferenceAnnotation = Symbol.for('@dxos/schema/annotation/Reference');
export type ReferenceAnnotationValue = {};

// TODO(dmaretskyi): Assert that schema has `id`.
export const ref = <T extends Identifiable>(targetType: S.Schema<T>): S.Schema<T> => {
  if (!getEchoObjectAnnotation(targetType)) {
    throw new Error('Reference target must be an ECHO object.');
  }

  return S.make(AST.setAnnotation(targetType.ast, ReferenceAnnotation, {}));
};

export const getRefAnnotation = (schema: S.Schema<any>) =>
  pipe(
    AST.getAnnotation<ReferenceAnnotationValue>(ReferenceAnnotation)(schema.ast),
    Option.getOrElse(() => undefined),
  );

/**
 * Returns the schema for the given object if one is defined.
 */
export const getSchema = <T extends {} = any>(obj: T): S.Schema<any> | undefined => {
  if (isReactiveProxy(obj)) {
    const proxyHandlerSlot = getProxyHandlerSlot(obj);
    if (proxyHandlerSlot.handler instanceof EchoReactiveHandler) {
      return proxyHandlerSlot.handler.getSchema();
    }
  }

  const schema = (obj as any)[symbolSchema];
  if (!schema) {
    return undefined;
  }

  invariant(S.isSchema(schema), 'Invalid schema.');
  return schema as S.Schema<T>;
};

export const metaOf = <T extends {}>(obj: T): ObjectMeta => {
  const proxy = getProxyHandlerSlot(obj);
  invariant(proxy.handler instanceof EchoReactiveHandler, 'Not a reactive ECHO object');
  return proxy.handler.getMeta();
};

export const getTypeReference = (schema: S.Schema<any>): Reference | undefined => {
  const annotation = getEchoObjectAnnotation(schema);
  if (annotation == null) {
    return undefined;
  }
  return Reference.fromLegacyTypename(annotation.typename);
};

export type PropertyVisitor<T> = (property: AST.PropertySignature, path: PropertyKey[]) => T;

/**
 * Recursively visit properties of the given object.
 */
// TODO(burdon): Ref unist-util-visit (e.g., specify filter).
export const visit = (root: AST.AST, visitor: PropertyVisitor<void>, rootPath: PropertyKey[] = []): void => {
  AST.getPropertySignatures(root).forEach((property) => {
    const path = [...rootPath, property.name];
    visitor(property, path);

    // Recursively visit properties.
    const { type } = property;
    if (AST.isTypeLiteral(type)) {
      visit(type, visitor, path);
    } else if (AST.isUnion(type)) {
      type.types.forEach((type) => {
        if (AST.isTypeLiteral(type)) {
          visit(type, visitor, path);
        }
      });
    }
  });
};

export const reduce = <T>(
  root: AST.AST,
  visitor: (acc: T, property: AST.PropertySignature, path: PropertyKey[]) => T,
  initialValue: T,
): T => {
  let acc = initialValue;
  visit(root, (property, path) => {
    acc = visitor(acc, property, path);
  });

  return acc;
};
