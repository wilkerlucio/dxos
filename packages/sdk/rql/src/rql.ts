//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';

type Resolvers<TArgs extends Record<string, S.Schema<any>>, TResults extends S.Struct.Fields> = {
  // TODO(wittjosiah): Support args of never for no args.
  [k in keyof Pick<TResults, keyof TArgs>]: (
    args?: S.Schema.Type<TArgs[k]>,
  ) => MaybePromise<S.Schema.Type<TResults[k]>>;
};

interface ResolverClass<TArgs extends Record<string, S.Schema<any>>, TResults extends S.Struct.Fields> {
  args: TArgs;
  resolvers: Resolvers<TArgs, TResults>;
}

export type RQLOptions<
  T extends Object,
  TArgs extends Record<string, S.Schema<any>>,
  TResults extends S.Struct.Fields,
> = {
  root: {
    // TODO(wittjosiah): Remove args for root.
    new (args: any): T & ResolverClass<TArgs, TResults>;
    fields: S.Struct.Fields;
  };
  schema: S.Schema<any>[];
};

export class RQL<T extends Object, TArgs extends Record<string, S.Schema<any>>, TResults extends S.Struct.Fields> {
  private _rootClass: RQLOptions<T, TArgs, TResults>['root'];
  private _root: T & ResolverClass<TArgs, TResults>;

  constructor({ root: Root, schema }: RQLOptions<T, TArgs, TResults>) {
    this._rootClass = Root;
    this._root = new Root({});
  }

  async query(query: Query<T>): Promise<QueryResult<T, typeof query>> {
    // TODO(wittjosiah): Make recursive.
    const keys = Object.keys(query);
    const result = keys.reduce(
      (acc, key) => {
        const resolver = this._root.resolvers[key];
        const resolverSchema = this._rootClass.fields[key];
        const args = query[key];
        if (!!resolver && resolverSchema && args) {
          // TODO(wittjosiah): Validate args. Call resolver. Validate result.
          return { ...acc, [key]: key as any };
        } else {
          return acc;
        }
      },
      {} as QueryResult<T, typeof query>,
    );

    return result;
  }
}

class Section extends S.TaggedClass<Section>()('plugin-stack/section', {
  content: S.any, // Echo Object
  opened: S.boolean, // Ephemeral state
}) {}

class Stack
  extends S.TaggedClass<Stack>()('plugin-stack/stack', {
    id: S.string,
    name: S.string,
    sections: S.array(Section),
  })
  implements ResolverClass<typeof Stack.prototype.args, typeof Stack.fields>
{
  readonly args = {
    // TODO(wittjosiah): Never.
    sections: S.struct({}),
  };

  readonly resolvers: Resolvers<typeof this.args, typeof Stack.fields> = {
    sections: async () => {
      // 1) Query echo for sections.
      // 2) Lookup open state in local storage.
      return [];
    },
  };
}

class Folder
  extends S.TaggedClass<Folder>()('plugin-folder/folder', {
    id: S.string,
    name: S.string,
    items: S.array(
      S.struct({
        id: S.string,
        name: S.string,
      }),
    ),
  })
  implements ResolverClass<typeof Folder.prototype.args, typeof Folder.fields>
{
  readonly args = {
    items: S.struct({
      limit: S.number,
      offset: S.number,
    }),
  };

  readonly resolvers: Resolvers<typeof this.args, typeof Folder.fields> = {
    items: async (args) => {
      // 1) Query echo for items.
      return [];
    },
  };
}

class Root
  extends S.Class<Root>('Root')({
    listFolders: S.array(Folder),
    listStacks: S.array(Stack),
  })
  implements ResolverClass<typeof Root.prototype.args, typeof Root.fields>
{
  readonly args = {
    listFolders: S.struct({}),
    listStacks: S.struct({}),
  };

  // TODO(wittjosiah): Wrapper of S.Class which infers the type of the resolvers.
  readonly resolvers: Resolvers<typeof this.args, typeof Root.fields> = {
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
  schema: [Folder, Stack],
});

void rql.query({
  listStacks: {
    id: true,
    name: true,
    sections: {
      content: true,
      opened: true,
    },
  },
});

// Internal Types

// TODO(wittjosiah): Which of these need to be exposed?

type ElementType<T> = T extends (infer U)[] | readonly (infer U)[] ? U : T;

type Object = Record<string | symbol | number, any>;

type MaybePromise<T> = T | Promise<T>;

type ResolverFunction<TArgs, TResult> = (args?: TArgs) => MaybePromise<TResult>;

type Query<T> =
  T extends ResolverClass<infer TArgs, infer TResults>
    ? S.Simplify<
        Partial<{
          [k in keyof Pick<TResults, keyof TArgs>]: QueryField<
            ResolverFunction<S.Schema.Type<TArgs[k]>, S.Schema.Type<TResults[k]>>
          >;
        }> &
          Partial<{
            [key in keyof Omit<T, 'args' | 'resolvers' | '_tag' | keyof TArgs>]: boolean;
          }>
      >
    : T extends Object
      ? Partial<{ [key in keyof Omit<T, '_tag'>]: boolean }>
      : never;

type ArgsQuery<TArgs, TResult> = { args: TArgs; query: TResult };

type QueryField<T> =
  // TODO(wittjosiah): Never for no args.
  T extends ResolverFunction<{}, infer TResult>
    ? QueryResolverResult<TResult>
    : T extends ResolverFunction<infer TArgs, infer TResult>
      ? // QueryFunction<TArgs, QueryResolverResult<TResult>>
        ArgsQuery<TArgs, QueryResolverResult<TResult>>
      : boolean;

type QueryResolverResult<T> = ElementType<T> extends Object ? Query<ElementType<T>> : ElementType<T>;

type QueryResult<T extends Object = {}, TQuery extends Query<T> = Query<T>> = Required<{
  [key in keyof Pick<T, keyof TQuery>]: ResultField<T[key], TQuery[key]>;
}>;

// TODO(wittjosiah): Why `undefined | unknown`?
type ResultField<T, TQuery extends QueryField<T> | undefined | unknown> = T extends any[] | readonly any[]
  ? ResultField<ElementType<T>, TQuery>[]
  : T extends ResolverClass<any, infer TResult>
    ? ResultFieldResolver<S.Schema.Type<S.struct<TResult>>, TQuery>
    : ResultFieldResolver<T, TQuery>;

// TODO(wittjosiah): Fix type errors.
type ResultFieldResolver<TResult, TQuery extends QueryField<TResult> | undefined | unknown> = TResult extends Object
  ? TQuery extends ArgsQuery<any, infer TQueryResult>
    ? QueryResult<TResult, TQueryResult>
    : TQuery extends Object
      ? QueryResult<TResult, TQuery>
      : never
  : TResult;

export type A = Query<typeof Root.prototype>;
export type B = QueryResult<typeof Root.prototype>;

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
} satisfies Query<typeof Root.prototype>;

export const b: QueryResult<typeof Root.prototype, typeof a> = {
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

type C = Query<typeof Folder.prototype>;
export const c = {
  name: true,
  items: { args: { limit: 10, offset: 0 }, query: { name: true } },
} satisfies C;

type D = QueryResult<typeof Folder.prototype, typeof c>;
