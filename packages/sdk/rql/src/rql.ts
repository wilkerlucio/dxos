//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';
// import { Simplify } from 'effect/Types';

type Resolver = (args?: Record<string, any>) => MaybePromise<any>;

interface Resolvers {
  readonly resolvers: Record<string, Resolver | undefined>;
}

export type RQLOptions<T extends Object> = {
  root: {
    new (args: {}): T & Resolvers;
    fields: S.Struct.Fields;
  };
  schema: S.Schema<any>[];
};

export class RQL<T extends Object> {
  private _rootClass: RQLOptions<T>['root'];
  private _root: T & Resolvers;
  private _schema: RQLOptions<T>['schema'];

  constructor({ root: Root, schema }: RQLOptions<T>) {
    this._rootClass = Root;
    this._root = new Root({});
    this._schema = schema;
  }

  async query(query: Query<T>): Promise<QueryResult<T, typeof query>> {
    // TODO(wittjosiah): Make recursive.
    const keys = Object.keys(query);
    const result = keys.reduce(
      (acc, key) => {
        const resolver = this._root.resolvers[key];
        const resolverSchema = this._rootClass.fields[key];
        const args = query[key];
        if (resolver && resolverSchema && args) {
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

export const resolver = <TArgs = never, TResult = any>({
  args,
  result,
}: {
  args?: S.Schema<TArgs>;
  result: S.Schema<TResult>;
}) => S.optional(S.struct({ __args: args ?? S.never, __result: result }));

class Section extends S.TaggedClass<Section>()('plugin-stack/section', {
  content: S.any, // Echo Object
  opened: S.boolean, // Ephemeral state
}) {}

class Stack extends S.TaggedClass<Stack>()('plugin-stack/stack', {
  id: S.string,
  name: S.string,
  sections: resolver({
    result: S.array(Section),
  }),
}) {
  get resolvers() {
    return {
      sections: async () => {
        // 1) Query echo for sections.
        // 2) Lookup open state in local storage.
        return [];
      },
    };
  }
}

class Folder extends S.TaggedClass<Folder>()('plugin-folder/folder', {
  id: S.string,
  name: S.string,
  items: resolver({
    result: S.array(S.any),
  }),
}) {
  get resolvers() {
    return {
      items: async () => {
        // 1) Query echo for items.
        return [];
      },
    };
  }
}

class Root
  extends S.Class<Root>('Root')({
    listFolders: resolver({
      result: S.array(S.struct(Folder.fields)),
    }),
    listStacks: resolver({
      result: S.array(S.struct(Stack.fields)),
    }),
  })
  implements Resolvers
{
  // TODO(wittjosiah): Wrapper of S.Class which infers the type of the resolvers.
  readonly resolvers = {
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

type CustomResolver<TArgs, TResult> = {
  __args: TArgs;
  __result: TResult;
};

// TODO(wittjosiah): Update to QueryFunction.
type ResolverFunction<TArgs, TResult> = (args?: TArgs) => MaybePromise<TResult>;

type Query<T extends Object> = Partial<{
  [key in keyof Omit<T, '_tag' | 'resolvers'>]?: QueryField<T[key]>;
}>;

type QueryField<T> =
  T extends CustomResolver<never, infer TResult>
    ? QueryResolverResult<TResult>
    : T extends CustomResolver<infer TArgs, infer TResult>
      ? ResolverFunction<TArgs, QueryResolverResult<TResult>>
      : boolean;

type QueryResolverResult<T> = ElementType<T> extends Object ? Query<ElementType<T>> : ElementType<T>;

type QueryResult<T extends Object = {}, TQuery extends Query<T> = Query<T>> = Required<{
  [key in keyof Pick<T, keyof TQuery>]: ResultField<T[key], TQuery[key]>;
}>;

// TODO(wittjosiah): Why `undefined | unknown`?
type ResultField<T, TQuery extends QueryField<T> | undefined | unknown> =
  T extends CustomResolver<any, infer TResult> ? ResultFieldResolver<TResult, TQuery> : T;

type ResultFieldResolver<TResult, TQuery extends QueryField<TResult> | undefined | unknown> = TResult extends
  | any[]
  | readonly any[]
  ? ElementType<TResult> extends Object
    ? TQuery extends Object
      ? QueryResult<ElementType<TResult>, TQuery>[]
      : never
    : TResult
  : TResult extends Object
    ? TQuery extends Object
      ? QueryResult<TResult, TQuery>
      : never
    : TResult;

export type A = Query<typeof Root.prototype>;
export type B = QueryResult<typeof Root.prototype>;

export const a = {
  listStacks: {
    id: true,
    sections: {
      content: true,
      opened: true,
    },
  },
} satisfies Query<typeof Root.prototype>;

export const b: QueryResult<typeof Root.prototype, typeof a> = {
  listStacks: [
    {
      id: '1',
      sections: [{ content: 'Section 1', opened: true }],
    },
  ],
};
