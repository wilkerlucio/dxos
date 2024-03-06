//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';

export type RQLOptions<T extends Type> = {
  root: S.Schema<T>;
  resolvers: Resolvers<S.Schema.To<S.Schema<T>>>;
};

export class RQL<T extends Type> {
  private _root: S.Schema<T>;
  private _query: Query<S.Schema.To<typeof this._root>>;

  constructor({ root, resolvers }: RQLOptions<T>) {
    this._root = root;
    this._query = new Query(resolvers);
  }

  get query() {
    return this._query;
  }
}

export class Query<T extends Type> {
  constructor(private readonly _resolvers: Resolvers<T>) {}
}

export namespace R {
  export const resolver = <TArgs = any, TOutput extends Type = Type>({
    args,
    output,
  }: {
    args: S.Schema<TArgs>;
    output: S.Schema<TOutput>;
  }) => S.struct({ __args: args, __output: output });

  // TODO(wittjosiah): Literal becomes just a string.
  // export const type = <Fields extends S.StructFields>(typename: string, fields: Fields) =>
  //   S.extend(S.struct({ __typename: S.literal(typename) }), S.struct(fields));
}

const Root = S.struct({
  __typename: S.literal('Root'),
  getObjectById: R.resolver({
    args: S.string,
    output: S.struct({
      __typename: S.literal('Object'),
      id: S.string,
      name: S.string,
    }),
  }),
});

export const rql = new RQL({
  root: Root,
  resolvers: {
    Root: {
      getObjectById: async (parent, args) => {
        return {
          __typename: 'Object',
          id: args,
          name: 'foo',
        };
      },
    },
  },
});

// Internal Types

// TODO(wittjosiah): Which of these need to be exposed?

type Type = {
  __typename: string;
};

type ElementType<T> = T extends (infer U)[] ? U : T;

type Values<T> = ElementType<T[keyof T]>;

type NonPrimitive<T> = T extends Type ? T : never;

type NonPrimitiveValues<T> = NonPrimitive<Values<T>>;

// Tor type A | B, this will compute NonPrimitiveValues<A> | NonPrimitiveValues<B> instead of NonPrimitiveValues<A | B>.
type AllNonPrimitiveValues<T> = T extends infer U ? (U extends Type ? NonPrimitiveValues<U> : never) : never;

type RecursiveNonPrimitiveValues<T> = T extends never
  ? never
  : T | AllNonPrimitiveValues<T> | RecursiveNonPrimitiveValues<AllNonPrimitiveValues<T>>;

type MaybePromise<T> = T | Promise<T>;

type CustomResolver<TArgs = any, TOutput extends Type = Type> = {
  __args: TArgs;
  __output: TOutput;
};

type ResolverFunction<TParent extends Type, TArgs, TOutput extends Type> = (
  parent: TParent,
  args: TArgs,
) => MaybePromise<Partial<TOutput>>;

type FieldToResolver<T, TParent extends Type> =
  T extends CustomResolver<infer TArgs, infer TOutput>
    ? ResolverFunction<TParent, TArgs, TOutput>
    : T extends Type
      ? ResolverFunction<TParent, unknown, T>
      : never;

type ResolverFunctions<T extends {}, TParent extends Type> = {
  [key in keyof T]?: FieldToResolver<T[key], TParent>;
};

type Resolvers<T extends Type> = {
  [typename in RecursiveNonPrimitiveValues<T>['__typename']]?: ResolverFunctions<
    Omit<Extract<RecursiveNonPrimitiveValues<T>, { __typename: typename }>, '__typename'>,
    Extract<RecursiveNonPrimitiveValues<T>, { __typename: typename }>
  >;
};
