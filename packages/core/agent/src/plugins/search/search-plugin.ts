//
// Copyright 2023 DXOS.org
//

import MiniSearch from 'minisearch';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { PublicKey } from '@dxos/client';
import { type Space } from '@dxos/client/echo';
import { Context } from '@dxos/context';
import { type Query, type Subscription, type TypedObject } from '@dxos/echo-schema';
import { invariant } from '@dxos/invariant';
import { log } from '@dxos/log';
import { SearchRequest, type SearchResponse } from '@dxos/protocols/proto/dxos/agent/search';
import { type GossipMessage } from '@dxos/protocols/proto/dxos/mesh/teleport/gossip';
import { ComplexMap } from '@dxos/util';

import { Plugin } from '../plugin';

export const SEARCH_CHANNEL = 'dxos.org/agent/plugin/search';

export class Search extends Plugin {
  public readonly id = 'dxos.org/agent/plugin/search';
  private _ctx?: Context;
  private _index?: MiniSearch;

  private readonly _spaceIndexes = new ComplexMap<PublicKey, SpaceIndex>(PublicKey.hash);

  private readonly _indexOptions = {
    fields: ['json'],
    idField: 'id',
  };

  private readonly _indexedObjects = new Map<string, IndexDocument>();

  constructor(private readonly _indexPath?: string) {
    super();
    if (this._indexPath && existsSync(this._indexPath)) {
      try {
        const serializedIndex = readFileSync(this._indexPath, { encoding: 'utf8' });
        const { index, options } = JSON.parse(serializedIndex);
        this._index = MiniSearch.loadJS(index, options);
      } catch (error) {
        log.warn('Failed to load index from file:', { error });
      }
    }
  }

  async open(): Promise<void> {
    log.info('Opening indexing plugin...');

    if (!this._config.enabled) {
      log.info('Search disabled.');
      return;
    }
    this._ctx = new Context();

    invariant(this._pluginCtx);
    this._pluginCtx.client.spaces.isReady.subscribe(async (ready) => {
      if (!ready) {
        return;
      }
      invariant(this._pluginCtx, 'Client is undefined.');

      const space = this._pluginCtx.client.spaces.default;

      const unsubscribe = space.listen(SEARCH_CHANNEL, async (message) => {
        log('received message', { message });
        await this._processMessage(message);
      });

      this._ctx?.onDispose(unsubscribe);
    });

    this._indexSpaces().catch((error: Error) => log.catch(error));
    this.statusUpdate.emit();
  }

  async close(): Promise<void> {
    this._saveIndex();
    this._spaceIndexes.clear();
    this._indexedObjects.clear();
    this._index?.removeAll();
    this._index = undefined;
    void this._ctx?.dispose();
    this.statusUpdate.emit();
  }

  // TODO(mykola): Save index periodically.
  private _saveIndex() {
    if (this._indexPath) {
      invariant(this._index);
      const serializedIndex = JSON.stringify({ index: this._index.toJSON(), options: this._indexOptions });
      log('Saving index to file:', { path: this._indexPath });
      writeFileSync(this._indexPath, serializedIndex, { encoding: 'utf8' });
    }
  }

  private async _indexSpaces() {
    if (!this._index) {
      this._index = new MiniSearch(this._indexOptions);
    }
    const process = async (spaces: Space[]) =>
      Promise.all(
        spaces.map(async (space) => {
          if (!this._spaceIndexes.has(space.key)) {
            this._spaceIndexes.set(space.key, await this._indexSpace(space));
          }
        }),
      );

    invariant(this._pluginCtx, 'Client is undefined.');
    await this._pluginCtx.client.spaces.isReady.wait();
    const sub = this._pluginCtx.client.spaces.subscribe(process);
    this._ctx?.onDispose(() => sub.unsubscribe());
    await process(this._pluginCtx.client.spaces.get());
  }

  private async _indexSpace(space: Space): Promise<SpaceIndex> {
    await space.waitUntilReady();
    const query = space.db.query();
    const processObjects = (objects: TypedObject[]) => {
      objects.forEach((object) => {
        const document: IndexDocument = {
          id: `${space.key.toHex()}:${object.id}`,
          json: JSON.stringify(object.toJSON()),
        };
        if (this._indexedObjects.has(document.id)) {
          this._index!.remove(this._indexedObjects.get(document.id)!);
        }
        this._index!.add(document);
        this._indexedObjects.set(document.id, document);
      });
    };

    const spaceIndex = {
      space,
      query,
      subscription: query.subscribe((query) => {
        invariant(this._index);
        processObjects(query.objects);
      }),
    };

    this._ctx?.onDispose(() => spaceIndex.subscription());

    processObjects(query.objects);
    return spaceIndex;
  }

  private async _processMessage(message: GossipMessage) {
    if (message.payload['@type'] !== 'dxos.agent.search.SearchRequest') {
      log.warn('Indexing plugin received unexpected message type.', { type: message.payload['@type'] });
      return;
    }
    const request: SearchRequest = message.payload;
    if (request.query) {
      const response = this._search(request);
      await this._pluginCtx!.client!.spaces.default.postMessage(SEARCH_CHANNEL, {
        '@type': 'dxos.agent.search.SearchResponse',
        ...response,
      });
    }
  }

  private _search(request: SearchRequest): SearchResponse {
    invariant(this._index);
    const results = this._index!.search(request.query, { fuzzy: request.type === SearchRequest.Type.FUZZY });
    return {
      results: results.map((result) => {
        return {
          spaceKey: result.id.split(':')[0],
          objectId: result.id.split(':')[1],
          score: result.score,
          matches: Object.entries(result.match).map(([term, keys]) => ({
            term,
          })),
        };
      }),
    };
  }
}

type IndexDocument = {
  id: string;
  json: string;
};

type SpaceIndex = {
  space: Space;
  query: Query;
  subscription: Subscription;
};