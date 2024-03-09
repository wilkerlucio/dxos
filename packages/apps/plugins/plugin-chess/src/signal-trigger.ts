//
// Copyright 2024 DXOS.org
//

import { JSONSchema } from '@effect/schema';
import * as S from '@effect/schema/Schema';

import { Game } from '@dxos/chess-app';
import { SignalTrigger } from '@dxos/functions-signal';
import { PublicKey } from '@dxos/keys';
import { type Space } from '@dxos/react-client/echo';

export const MoveSuggestionOutputFormat = S.struct({
  from: S.string.pipe(S.description('From square')),
  to: S.string.pipe(S.description('To square')),
});

export const createSignalTrigger = (space: Space) => {
  return SignalTrigger.fromMutations(space)
    .withFilter(Game.filter())
    .debounceMs(5_000)
    .unique((prev, curr) => prev.pgn === curr.pgn)
    .create((game) => {
      return {
        id: PublicKey.random().toHex(),
        kind: 'suggestion',
        metadata: {
          createdMs: Date.now(),
          source: 'plugin-chess',
        },
        data: {
          type: 'suggest-next-chess-move',
          value: {
            gameState: game.pgn,
            outputFormat: JSONSchema.make(MoveSuggestionOutputFormat),
            activeObjectId: game.id,
          },
        },
      };
    });
};
