//
// Copyright 2023 DXOS.org
//

import { effect } from '@preact/signals-core';
// import { yieldOrContinue } from 'main-thread-scheduling';

import { EventSubscriptions } from '@dxos/async';
import { invariant } from '@dxos/invariant';

import { Graph } from './graph';
import { type EdgeDirection, type NodeArg, type NodeBase } from './node';

export type ConnectorExtension = (params: {
  node: NodeBase;
  direction: EdgeDirection;
  type?: string;
}) => NodeArg<any>[];
export type HydratorExtension = (params: { id: string; type: string }) => NodeArg<any>;

export type ExtensionType = 'connector' | 'hydrator';
export type BuilderExtension =
  | {
      type: 'connector';
      extension: ConnectorExtension;
    }
  | {
      type: 'hydrator';
      extension: HydratorExtension;
    };

export const connector = (extension: ConnectorExtension): BuilderExtension => ({ type: 'connector', extension });
export const hydrator = (extension: HydratorExtension): BuilderExtension => ({ type: 'hydrator', extension });

export type GraphBuilderTraverseOptions = {
  node: NodeBase;
  direction?: EdgeDirection;
  visitor: (node: NodeBase, path: string[]) => void;
};

class BuilderInternal {
  static currentExtension?: string;
  static hookIndex?: number;
  static hooks: Record<string, any[]> = {};
}

export const memoize = <T>(fn: () => T): T => {
  invariant(BuilderInternal.currentExtension, 'memoize must be called within an extension');
  invariant(BuilderInternal.hookIndex !== undefined, 'memoize must be called within an extension');
  const current = BuilderInternal.hooks[BuilderInternal.currentExtension][BuilderInternal.hookIndex];
  const result = current ? current.result : fn();
  BuilderInternal.hooks[BuilderInternal.currentExtension][BuilderInternal.hookIndex] = { result };
  BuilderInternal.hookIndex++;
  return result;
};

/**
 * The builder provides an extensible way to compose the construction of the graph.
 */
export class GraphBuilder {
  private readonly _extensions = new Map<string, BuilderExtension>();
  private readonly _unsubscribe = new EventSubscriptions();

  /**
   * Register a node builder which will be called in order to construct the graph.
   */
  addExtension(id: string, extension: BuilderExtension): GraphBuilder {
    this._extensions.set(id, extension);
    return this;
  }

  /**
   * Remove a node builder from the graph builder.
   */
  removeExtension(id: string): GraphBuilder {
    this._extensions.delete(id);
    return this;
  }

  /**
   * Construct the graph, starting by calling all registered extensions.
   * @param previousGraph If provided, the graph will be updated in place.
   */
  build(previousGraph?: Graph): Graph {
    // Clear previous extension subscriptions.
    this._unsubscribe.clear();

    const graph: Graph =
      previousGraph ??
      new Graph({
        onInitialNode: (id, type) => {
          for (const hydratorId in this._hydrators) {
            const extension = this._hydrators[hydratorId];
            BuilderInternal.hooks[hydratorId] = [];

            let node: NodeArg<any> | undefined;
            const unsubscribe = effect(() => {
              BuilderInternal.currentExtension = hydratorId;
              BuilderInternal.hookIndex = 0;
              const maybeNode = extension({ id, type });
              if (maybeNode) {
                node = maybeNode;
              }
              if (maybeNode && node) {
                graph._addNodes([node]);
              }
            });

            if (node) {
              this._unsubscribe.add(unsubscribe);
              return node;
            } else {
              unsubscribe();
            }
          }
        },
        onInitialNodes: (node, direction, type) => {
          let initial: NodeArg<any>[];
          let previous: string[] = [];
          this._unsubscribe.add(
            // this should be async so that it can yield to the main thread
            effect(() => {
              // this needs to track which extension is being called at each step
              // then "hooks" can be added inside the extension to manage subscriptions
              // specifically `memoize` query/signal creation
              const nodes = this._connectors.flatMap((extension) => extension({ node, direction, type }));
              const ids = nodes.map((n) => n.id);
              const removed = previous.filter((id) => !ids.includes(id));
              previous = ids;

              if (initial) {
                graph._removeNodes(removed);
                graph._addNodes(nodes);
              } else {
                initial = nodes;
              }
            }),
          );

          return initial!;
        },
      });

    return graph;
  }

  destroy() {
    this._unsubscribe.clear();
  }

  /**
   * Traverse a graph using just the connector extensions, without subscribing to any signals or persisting any nodes.
   */
  async traverse({ node, direction = 'outbound', visitor }: GraphBuilderTraverseOptions, path: string[] = []) {
    // Break cycles.
    if (path.includes(node.id)) {
      return;
    }

    // TODO(wittjosiah): Failed in test environment. ESM only?
    // await yieldOrContinue('idle');
    visitor(node, [...path, node.id]);

    const nodes = this._connectors
      .flatMap((extension) => extension({ node, direction }))
      .map(
        (arg): NodeBase => ({
          id: arg.id,
          type: arg.type,
          data: arg.data ?? null,
          properties: arg.properties ?? {},
        }),
      );

    await Promise.all(nodes.map((n) => this.traverse({ node: n, direction, visitor }, [...path, node.id])));
  }

  private get _hydrators() {
    return Array.from(this._extensions.values())
      .filter((extension) => extension.type === 'hydrator')
      .map(({ extension }) => extension) as HydratorExtension[];
  }

  private get _connectors() {
    return Array.from(this._extensions.values())
      .filter((extension) => extension.type === 'connector')
      .map(({ extension }) => extension) as ConnectorExtension[];
  }
}
