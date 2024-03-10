//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';
// import { Simplify } from 'effect/Types';

type Resolver = (args?: Record<string, any>) => MaybePromise<any>;

interface Resolvers {
  readonly resolvers: Record<string, Resolver>;
}

export type RQLOptions<T> = {
  root: {
    new (args: {}): S.Schema.To<S.Schema<T>> & Resolvers;
    struct: S.Schema<T>;
  };
  schema: S.Schema<any>[];
};

export class RQL<T> {
  private _rootClass: RQLOptions<T>['root'];
  private _rootSchema: S.Schema<T & Resolvers>;
  private _root: T & Resolvers;
  private _schema: RQLOptions<T>['schema'];

  constructor({ root: Root, schema }: RQLOptions<T>) {
    this._rootClass = Root;
    this._rootSchema = S.instanceOf(Root);
    this._root = new Root({});
    this._schema = schema;
  }

  get query(): ResolverFunctions<S.Schema.To<typeof this._rootSchema>> {
    // TODO(wittjosiah): Wrap with schema validation.
    return this._root.resolvers as ResolverFunctions<S.Schema.To<typeof this._rootSchema>>;
  }
}

export const resolver = <TArgs = any, TResult = any>({
  args = S.any,
  result,
}: {
  args?: S.Schema<TArgs>;
  result: S.Schema<TResult>;
}) => S.optional(S.struct({ __args: args, __result: result }));

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
  extends S.Class<Root>()({
    listFolders: resolver({
      result: S.array(Folder.struct),
    }),
    listStacks: resolver({
      result: S.array(Stack.struct),
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

const stacks = await rql.query.listStacks();

console.log(stacks);

// Internal Types

// TODO(wittjosiah): Which of these need to be exposed?

type MaybePromise<T> = T | Promise<T>;

type CustomResolver<TArgs = any, TResult extends {} = {}> = {
  __args: TArgs;
  __result: TResult;
};

type ResolverResult<T> =
  T extends CustomResolver<any, infer TResult>
    ? TResult
    : T extends {}
      ? { [key in keyof T]: ResolverResult<T[key]> }
      : T;

type ResolverFunction<TArgs, TResult extends {}> = (args?: TArgs) => MaybePromise<ResolverResult<TResult>>;

type FieldToResolver<T> =
  T extends CustomResolver<infer TArgs, infer TResult> ? ResolverFunction<TArgs, TResult> : never;

type ResolverFunctions<T extends {}> = Required<{
  [key in keyof Omit<T, 'resolvers'>]: FieldToResolver<T[key]>;
}>;
