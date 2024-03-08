//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';
import { type Simplify } from 'effect/Types';
// import { Simplify } from 'effect/Types';

type Resolver = (args?: Record<string, any>) => MaybePromise<any>;

interface Resolvers {
  readonly resolvers: Record<string, Resolver>;
}

export type RQLOptions<A, I, R, C, Self, Inherited, Proto> = {
  root: S.Class<A, I, R, C, Self, Inherited, Proto> & Resolvers;
  schema: S.Schema<any>[];
};

export class RQL<A, I, R, C, Self, Inherited, Proto> {
  private _root: RQLOptions<A, I, R, C, Self, Inherited, Proto>['root'];
  private _rootSchema: S.Schema<A & Omit<Inherited, keyof A> & Proto, A & Omit<Inherited, keyof A> & Proto, never>;
  private _schema: RQLOptions<A, I, R, C, Self, Inherited, Proto>['schema'];

  constructor({ root, schema }: RQLOptions<A, I, R, C, Self, Inherited, Proto>) {
    this._root = root;
    this._rootSchema = S.instanceOf(root);
    this._schema = schema;
  }

  get query(): ResolverFunctions<S.Schema.To<typeof this._rootSchema>> {
    return {} as any;
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

/// /////////

interface Hello {
  world(): void;
}

class Example
  extends S.Class<Example>()({
    name: S.optional(S.string),
  })
  implements Hello
{
  world() {
    console.log(`Hello, ${this.name}!`);
  }
}

const test = (hello: Hello) => {
  hello.world();
};

const x = new Example({ name: 'world' });

type C = typeof x;
type D = C['world'];

type A = typeof Example.prototype;
type B = A['world'];
