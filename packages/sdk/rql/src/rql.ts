//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';

import { invariant } from '@dxos/invariant';

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
  TRoot extends QuerySchema<T, TFields, TArgs>,
  TSchema extends TypeClass<any>,
> {
  _root: RQLOptions<T, TFields, TArgs, TSchema>['root'];
  _schema: Required<RQLOptions<T, TFields, TArgs, TSchema>>['schema'];

  constructor({ root, schema = [] }: RQLOptions<T, TFields, TArgs, TSchema>) {
    this._root = root;
    this._schema = schema;
  }

  async query<TQuery extends Query<TRoot, TypeClassByTypename<TSchema>>>(
    query: TQuery,
  ): Promise<QueryResult<TRoot, TypeClassByTypename<TSchema>, TQuery>> {
    return resolve({
      query,
      args: this._root.args,
      resolvers: this._root.resolvers,
      fields: this._root.fields,
    });
  }
}

const resolve = async ({
  query,
  args,
  fields,
  resolvers,
}: {
  query: Record<string, any>;
  args: Record<string, S.Schema<any>>;
  resolvers: Record<string, any>;
  fields: S.Struct.Fields;
}) => {
  // Steps
  // 1. Get all keys in the query.
  // 2. For each key, determine whether its resolved field or an instrinsic field.
  // 3. For each key associated with a resolved field, get any args from the
  //    query and get the schema for the args and validate the args.
  // 4. For each key associated with a resolved field, find the associated
  //    resolver and call the resolver with the validated args.
  // 5. ***** Determine sub-schemas which still need resolution.
  // 6. ***** For each sub-schema, get sub-queries, args, fields, and resolvers,
  //    then recurse (mapping over an array if necessary).
  // 7. Validate the resolved results. (Try to find ways to avoid validating the
  //    same data multiple times when recursing.)
  // 8. Stitch nest results together.
  // 9. Return the result.

  const keys = Object.keys(query); // 1
  const results = await Promise.all(
    keys.map(async (key) => {
      const resolver = resolvers[key]; // 2
      if (!resolver) {
        return [key, undefined];
      }

      const argsSchema = args[key];
      const queryArgs = query[key]?.args; // 3
      invariant(argsSchema, `Missing schema for args of field: ${key}`);
      const result = (await S.validate(argsSchema)(queryArgs)) ? await resolver(queryArgs) : await resolver(); // 4

      // TODO(wittjosiah): 5/6.

      const resultSchema = fields[key];
      invariant(resultSchema, `Missing schema for field: ${key}`);
      const validatedResult = await S.validate(resultSchema)(result); // 7

      return [key, validatedResult];
    }),
  );

  return Object.fromEntries(results);
};

//
// Internal Types
//

// TODO(wittjosiah): Which of these need to be exposed?

type ElementType<T> = T extends (infer U)[] | readonly (infer U)[] ? U : T;

type Object = Record<string | symbol | number, any>;

type MaybePromise<T> = T | Promise<T>;

type Type<T extends string = string> = {
  // TODO(wittjosiah): This should probably be something like `__typename`.
  //   Currently using `_tag` because it is provided by @effect/schema already.
  _tag: T;
};

type Typename<T> = T extends Type<infer U> ? U : never;

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

// TODO(wittjosiah): This needs an explanation.
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type GroupByTypename<T> =
  T extends StaticAndInstanceType<infer U>
    ? U['prototype'] extends Type<infer Tag>
      ? { [K in Tag]: U }
      : never
    : never;

type TypeClassByTypename<T extends TypeClass<any>> = UnionToIntersection<GroupByTypename<Magic<T>>>;

type ClassLookup = TypeClassByTypename<TypeClass<any>>;

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

type Query<T, TLookup> = TLookup extends ClassLookup
  ? T extends QuerySchema<infer TSchema, infer TFields, infer TArgs>
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
        : never
  : never;

type ResolverFunction<TArgs, TResult> = (args?: TArgs) => MaybePromise<Partial<TResult>>;

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

type QueryResolverResult<T, TLookup extends ClassLookup> =
  ElementType<T> extends Object ? Query<GetClass<ElementType<T>, TLookup>, TLookup> : ElementType<T>;

type GetClass<T, TLookup extends ClassLookup> = Typename<T> extends never ? T : TLookup[Typename<T>];

type ArgsQuery<TArgs, TResult> = { args: TArgs; query: TResult };

type QueryResult<T, TLookup, TQuery extends Object> = TLookup extends ClassLookup
  ? T extends QuerySchema<any, infer TFields, any>
    ? Required<{
        [k in keyof Pick<TFields, keyof TQuery>]: ResultField<S.Schema.Type<TFields[k]>, TLookup, TQuery[k]>;
      }>
    : T extends Object
      ? Required<{
          [k in keyof Pick<T, keyof TQuery>]: ResultField<T[k], TLookup, TQuery[k]>;
        }>
      : never
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

//
// Examples
//

class Section extends S.TaggedClass<Section>()('plugin-stack/section', {
  // NOTE: Limitation here that `any` is not going to work because it short-circuits all type inference for the query.
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

export type L = TypeClassByTypename<ElementType<typeof rql._schema>>;
export type A = Query<typeof rql._root, TypeClassByTypename<ElementType<typeof rql._schema>>>;
export type B = QueryResult<typeof rql._root, TypeClassByTypename<ElementType<typeof rql._schema>>, A>;

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

export const b: QueryResult<typeof rql._root, TypeClassByTypename<ElementType<typeof rql._schema>>, typeof a> = {
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

type C = Query<typeof Folder, TypeClassByTypename<ElementType<typeof rql._schema>>>;
export const c = {
  name: true,
  items: { args: { limit: 10, offset: 0 }, query: { name: true } },
} satisfies C;

export type D = QueryResult<typeof Folder, TypeClassByTypename<ElementType<typeof rql._schema>>, typeof c>;
