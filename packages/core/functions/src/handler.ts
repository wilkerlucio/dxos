//
// Copyright 2023 DXOS.org
//

import * as S from '@effect/schema/Schema';
import * as Either from 'effect/Either';

import { type Client, PublicKey } from '@dxos/client';
import { type Space } from '@dxos/client/echo';
import { isTypedObject, type TypedObject } from '@dxos/echo-schema';
import { log } from '@dxos/log';
import { nonNullable } from '@dxos/util';

import { type Signal } from './signal/signal-bus';

// TODO(burdon): No response?
export interface Response {
  status(code: number): Response;
  body(value: any): Response;
}

// TODO(burdon): Limit access to individual space?
export interface FunctionContext {
  client: Client;
  dataDir?: string;
}

// TODO(burdon): Model after http request. Ref Lambda/OpenFaaS.
// https://docs.aws.amazon.com/lambda/latest/dg/typescript-handler.html
export type FunctionHandler<T extends {}> = (params: {
  event: T;
  context: FunctionContext;
  response: Response;
}) => Promise<Response | void>;

export type FunctionSubscriptionEvent = {
  space?: string; // TODO(burdon): Convert to PublicKey.
  objects?: string[];
};

export type FunctionSubscriptionEvent2 = {
  space?: Space;
  objects?: TypedObject[];
};

/**
 * Handler wrapper for subscription events; extracts space and objects.
 *
 * To test:
 * ```
 * curl -s -X POST -H "Content-Type: application/json" --data '{"space": "0446...1cbb"}' http://localhost:7100/dev/email-extractor
 * ```
 *
 * NOTE: Get space key from devtools or `dx space list --json`
 */
export const subscriptionHandler = (
  handler: FunctionHandler<FunctionSubscriptionEvent2>,
): FunctionHandler<FunctionSubscriptionEvent> => {
  return ({ event, context, ...rest }) => {
    const { client } = context;
    const space = event.space ? client.spaces.get(PublicKey.from(event.space)) : undefined;
    const objects =
      space &&
      event.objects
        ?.map<TypedObject | undefined>((id) => space!.db.getObjectById(id))
        .filter(nonNullable)
        .filter(isTypedObject);

    if (!!event.space && !space) {
      log.warn('invalid space', { event });
    } else {
      log.info('handler', { space: space?.key.truncate(), objects: objects?.length });
    }

    return handler({ event: { space, objects }, context, ...rest });
  };
};

export const signalHandler = <T extends object>(
  inputSchema: S.Schema<T>,
  handler: FunctionHandler<T>,
): FunctionHandler<Signal> => {
  const validator = S.validateEither(inputSchema);
  return async ({ event, context, ...rest }) => {
    const validated = validator(event.data.value);
    if (Either.isLeft(validated)) {
      log.warn('function was called with input not matching its schema', { event, error: validated.left });
      return rest.response.status(400);
    }
    return handler({ event: validated.right, context, ...rest });
  };
};
