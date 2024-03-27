//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';

export type RQLOptions<
  T extends Object,
  TFields extends S.Struct.Fields,
  TArgs extends Record<string, S.Schema<any>>,
  TSchema extends TypeClass<any>,
> = {
  root: QuerySchema<T, TFields, TArgs>;
  schema?: TSchema[];
};

export class RQL<
  T extends Object,
  TFields extends S.Struct.Fields,
  TArgs extends Record<string, S.Schema<any>>,
  TSchema extends TypeClass<any>,
> {
  _root: RQLOptions<T, TFields, TArgs, TSchema>['root'];
  _schema: Required<RQLOptions<T, TFields, TArgs, TSchema>>['schema'];

  constructor({ root, schema = [] }: RQLOptions<T, TFields, TArgs, TSchema>) {
    this._root = root;
    this._schema = schema;
  }

  // TODO(wittjosiah): Fix inferred query types.
  async query(
    query: Query<typeof this._root, TypeClassByTypename<typeof this._schema>>,
  ): Promise<QueryResult<typeof this._root, TypeClassByTypename<typeof this._schema>, typeof query>> {
    // TODO(wittjosiah): Make recursive.
    const keys = Object.keys(query);
    const result = keys.reduce(
      (acc, key) => {
        const resolver = this._root.resolvers[key];
        const argsSchema = this._root.args[key];
        const resultSchema = this._root.fields[key];
        const args = query[key];
        if (!!resolver && resultSchema && argsSchema && args) {
          // TODO(wittjosiah): Validate args. Call resolver. Validate result.
          return { ...acc, [key]: key as any };
        } else {
          return acc;
        }
      },
      {} as QueryResult<typeof this._root, TypeClassByTypename<typeof this._schema>, typeof query>,
    );

    return result;
  }
}

// Example

class Section extends S.TaggedClass<Section>()('plugin-stack/section', {
  content: S.unknown, // Echo Object
  opened: S.boolean, // Ephemeral state
}) {}

class Stack extends S.TaggedClass<Stack>()('plugin-stack/stack', {
  id: S.string,
  name: S.string,
  sections: S.array(Section),
}) {
  static args = {
    // TODO(wittjosiah): Never.
    sections: S.struct({}),
  };

  static resolvers: Resolvers<typeof Stack.args, typeof Stack.fields> = {
    sections: async () => {
      // 1) Query echo for sections.
      // 2) Lookup open state in local storage.
      return [];
    },
  };
}

class Folder extends S.TaggedClass<Folder>()('plugin-folder/folder', {
  id: S.string,
  name: S.string,
  items: S.array(
    S.struct({
      id: S.string,
      name: S.string,
    }),
  ),
}) {
  static args = {
    items: S.struct({
      limit: S.number,
      offset: S.number,
    }),
  };

  static resolvers: Resolvers<typeof Folder.args, typeof Folder.fields> = {
    items: async (args) => {
      // 1) Query echo for items.
      return [];
    },
  };
}

class Root extends S.Class<Root>('Root')({
  listFolders: S.array(Folder),
  listStacks: S.array(Stack),
}) {
  static args = {
    listFolders: S.struct({}),
    listStacks: S.struct({}),
  };

  // TODO(wittjosiah): Wrapper of S.Class which infers the type of the resolvers.
  static resolvers: Resolvers<typeof Root.args, typeof Root.fields> = {
    listFolders: async () => {
      // 1) Query echo for folders.
      // 2) Lookup open directories in local storage.
      return [];
    },
    listStacks: async () => {
      // 1) Query echo for stacks.
      return [];
    },
  };
}

export const rql = new RQL({
  root: Root,
  schema: [Folder, Stack, Section],
});

export const query = async () => {
  const result = await rql.query({
    listStacks: {
      name: true,
      sections: {
        content: true,
      },
    },
  });

  return result;
};

// Internal Types

// TODO(wittjosiah): Which of these need to be exposed?

type ElementType<T> = T extends (infer U)[] | readonly (infer U)[] ? U : T;

type Object = Record<string | symbol | number, any>;

type MaybePromise<T> = T | Promise<T>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type Type<T extends string = string> = {
  _tag: T;
};

type TypeClass<T extends Type> = {
  prototype: T;
  fields: S.Struct.Fields;
};

type StaticAndInstanceType<T extends TypeClass<any>> = {
  instance: T['prototype'];
  static: T;
};

// For type A | B, this will compute StaticAndInstanceType<A> | StaticAndInstanceType<B>
// instead of StaticAndInstanceType<A | B>.
// TODO(wittjosiah): Name.
type Magic<T> = T extends infer U ? (U extends TypeClass<any> ? StaticAndInstanceType<U> : never) : never;

type Prototypes<T extends TypeClass<any>[]> = Magic<ElementType<T>>;

type Typename<T> = T extends Type<infer U> ? U : never;

type GroupByTypename<T> =
  T extends StaticAndInstanceType<infer U>
    ? U['prototype'] extends Type<infer Tag>
      ? { [K in Tag]: U }
      : never
    : never;

type TypeClassByTypename<T extends TypeClass<any>[]> = UnionToIntersection<GroupByTypename<Prototypes<T>>>;

type Resolvers<TArgs extends Record<string, S.Schema<any>>, TResults extends S.Struct.Fields> = {
  // TODO(wittjosiah): Support args of never for no args.
  [k in keyof Pick<TResults, keyof TArgs>]: (
    args?: S.Schema.Type<TArgs[k]>,
  ) => MaybePromise<S.Schema.Type<TResults[k]>>;
};

type QuerySchema<T, TFields extends S.Struct.Fields, TArgs extends Record<string, S.Schema<any>>> = S.Schema<T> & {
  args: TArgs;
  resolvers: Resolvers<TArgs, TFields>;
  fields: TFields;
  prototype: T;
};

type ClassLookup = Record<string | symbol | number, TypeClass<any>>;

type Query<T, TLookup extends ClassLookup> =
  T extends QuerySchema<infer TSchema, infer TFields, infer TArgs>
    ? S.Simplify<
        Partial<{
          [k in keyof Pick<TFields, keyof TArgs>]: QueryField<
            ResolverFunction<S.Schema.Type<TArgs[k]>, S.Schema.Type<TFields[k]>>,
            TLookup
          >;
        }> &
          Partial<{
            [k in keyof Omit<TSchema, 'args' | 'resolvers' | '_tag' | keyof TArgs>]: QueryField<TSchema[k], TLookup>;
          }>
      >
    : T extends TypeClass<any>
      ? Query<T['prototype'], TLookup>
      : T extends Object
        ? Partial<{ [k in keyof Omit<T, '_tag'>]: QueryField<T[k], TLookup> }>
        : never;

type ResolverFunction<TArgs, TResult> = (args?: TArgs) => MaybePromise<TResult>;

type ArgsQuery<TArgs, TResult> = { args: TArgs; query: TResult };

type QueryField<T, TLookup extends ClassLookup> =
  // TODO(wittjosiah): Never for no args.
  T extends ResolverFunction<{}, infer TResult>
    ? QueryResolverResult<TResult, TLookup>
    : T extends ResolverFunction<infer TArgs, infer TResult>
      ? ArgsQuery<TArgs, QueryResolverResult<TResult, TLookup>>
      : T extends any[] | readonly any[]
        ? QueryField<ElementType<T>, TLookup>
        : T extends Object
          ? boolean | Query<T, TLookup>
          : boolean;

type GetClass<T, TLookup extends ClassLookup> = Typename<T> extends never ? T : TLookup[Typename<T>];

type QueryResolverResult<T, TLookup extends ClassLookup> =
  ElementType<T> extends Object ? Query<GetClass<ElementType<T>, TLookup>, TLookup> : ElementType<T>;

type QueryResult<T, TLookup extends ClassLookup, TQuery extends Object> =
  T extends QuerySchema<any, infer TFields, any>
    ? Required<{
        [k in keyof Pick<TFields, keyof TQuery>]: ResultField<S.Schema.Type<TFields[k]>, TLookup, TQuery[k]>;
      }>
    : T extends Object
      ? Required<{
          [k in keyof Pick<T, keyof TQuery>]: ResultField<T[k], TLookup, TQuery[k]>;
        }>
      : never;

// TODO(wittjosiah): Why `undefined | unknown`?
type ResultField<
  T,
  TLookup extends ClassLookup,
  TQuery extends QueryField<T, TLookup> | undefined | unknown,
> = T extends any[] | readonly any[]
  ? ResultField<ElementType<T>, TLookup, TQuery>[]
  : T extends Type
    ? ResultField<GetClass<T, TLookup>, TLookup, TQuery>
    : T extends QuerySchema<any, infer TResult, any>
      ? ResultFieldResolver<S.Schema.Type<S.struct<TResult>>, TLookup, TQuery>
      : ResultFieldResolver<T, TLookup, TQuery>;

type ResultFieldResolver<
  TResult,
  TLookup extends ClassLookup,
  TQuery extends QueryField<TResult, TLookup> | undefined | unknown,
> = TResult extends Object
  ? TQuery extends ArgsQuery<any, infer TQueryResult>
    ? TQueryResult extends Object
      ? QueryResult<TResult, TLookup, TQueryResult>
      : never
    : TQuery extends Object
      ? QueryResult<TResult, TLookup, TQuery>
      : never
  : TResult;

export type L = TypeClassByTypename<typeof rql._schema>;
export type A = Query<typeof rql._root, TypeClassByTypename<typeof rql._schema>>;
export type B = QueryResult<typeof rql._root, TypeClassByTypename<typeof rql._schema>, A>;

export const a = {
  listFolders: {
    id: true,
    items: {
      args: { limit: 10, offset: 0 },
      query: {
        id: true,
      },
    },
  },
  listStacks: {
    name: true,
    sections: {
      content: true,
    },
  },
} satisfies A;

export const b: QueryResult<typeof rql._root, TypeClassByTypename<typeof rql._schema>, typeof a> = {
  listFolders: [
    {
      id: '1',
      items: [{ id: '1' }],
    },
  ],
  listStacks: [
    {
      name: 'Stack 1',
      sections: [{ content: 'Section 1' }],
    },
  ],
};

type C = Query<typeof Folder, TypeClassByTypename<typeof rql._schema>>;
export const c = {
  name: true,
  items: { args: { limit: 10, offset: 0 }, query: { name: true } },
} satisfies C;

export type D = QueryResult<typeof Folder, TypeClassByTypename<typeof rql._schema>, typeof c>;
