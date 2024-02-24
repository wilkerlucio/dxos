import * as S from '@effect/schema/Schema';
import * as E from './reactive';
import { describe, test } from '@dxos/test';
import { log } from '@dxos/log';
import set from 'lodash.set';
import { AST } from '@effect/schema';
import { getOrElse } from 'effect/Option';
import { pipe } from 'effect';

describe('Orama indexing of effect schema', () => {
  test.only('build schema', async () => {
    const Contact = S.struct({
      name: S.string.pipe(E.Index()),
      age: S.optional(S.number),
      address: S.optional(
        S.struct({
          street: S.optional(S.string),
          city: S.string.pipe(E.Index()),
        }),
      ),
    });

    type Contact = S.Schema.To<typeof Contact>;

    const schema = buildOramaSchemaFromEffectSchema(Contact);
    console.log(schema);
  });
});

type OramaSchema = Record<string, any>;

const buildOramaSchemaFromEffectSchema = (schema: S.Schema<any>): OramaSchema => {
  return E.reduce(
    schema.ast,
    (acc, property, path) => {
      // First
      if (
        pipe(
          property.type,
          E.getIndexAnnotation,
          getOrElse(() => false),
          (x) => !x,
        )
      ) {
        return acc;
      }

      // Second
      if (!property.type.annotations[E.IndexAnnotation]) {
        return acc;
      }

      return set(acc, path, getIndexType(property));
    },
    {},
  );
};

const getIndexType = (property: AST.PropertySignature): string => {
  switch (property.type._tag) {
    case 'StringKeyword':
      return 'string';
    case 'NumberKeyword':
      return 'number';
    case 'BooleanKeyword':
      return 'boolean';
    default:
      throw new Error(`Unsupported type: ${property.type._tag}`);
  }
};
