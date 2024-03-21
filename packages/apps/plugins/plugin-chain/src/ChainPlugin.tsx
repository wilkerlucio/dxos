//
// Copyright 2023 DXOS.org
//

import { Brain, type IconProps } from '@phosphor-icons/react';
import { batch, effect } from '@preact/signals-core';
import React from 'react';

import { parseClientPlugin } from '@braneframe/plugin-client';
import { updateGraphWithAddObjectAction } from '@braneframe/plugin-space';
import { Chain as ChainType, Thread as ThreadType } from '@braneframe/types';
import { resolvePlugin, parseIntentPlugin, type PluginDefinition } from '@dxos/app-framework';
import { EventSubscriptions } from '@dxos/async';
import { SignalTrigger } from '@dxos/functions-signal';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { Filter, type Space } from '@dxos/react-client/echo';

import { ChainMain } from './components';
import meta, { CHAIN_PLUGIN } from './meta';
import translations from './translations';
import { ChainAction, type ChainPluginProvides, isObject } from './types';

export const ChainPlugin = (): PluginDefinition<ChainPluginProvides> => {
  const triggerRegistry = new Map<string, () => void>();
  return {
    meta,
    provides: {
      metadata: {
        records: {
          [ChainType.schema.typename]: {
            placeholder: ['object placeholder', { ns: CHAIN_PLUGIN }],
            icon: (props: IconProps) => <Brain {...props} />,
          },
        },
      },
      translations,
      graph: {
        builder: (plugins, graph) => {
          const client = resolvePlugin(plugins, parseClientPlugin)?.provides.client;
          const dispatch = resolvePlugin(plugins, parseIntentPlugin)?.provides.intent.dispatch;
          if (!client || !dispatch) {
            return;
          }

          const subscriptions = new EventSubscriptions();
          const { unsubscribe } = client.spaces.subscribe((spaces) => {
            spaces.forEach((space) => {
              subscriptions.add(
                updateGraphWithAddObjectAction({
                  graph,
                  space,
                  plugin: CHAIN_PLUGIN,
                  action: ChainAction.CREATE,
                  properties: {
                    label: ['create object label', { ns: CHAIN_PLUGIN }],
                    icon: (props: IconProps) => <Brain {...props} />,
                    testId: 'chainPlugin.createObject',
                  },
                  dispatch,
                }),
              );

              const promptQuery = space.db.query(ChainType.Prompt.filter());
              let previousPrompts: ChainType.Prompt[] = [];
              subscriptions.add(
                effect(() => {
                  const removedObjects = previousPrompts.filter((object) => !promptQuery.objects.includes(object));
                  for (const prompt of removedObjects) {
                    for (const promptTrigger of prompt.echoTriggers ?? []) {
                      triggerRegistry.get(promptTrigger.id)?.();
                    }
                  }
                  previousPrompts = promptQuery.objects;
                  for (const prompt of promptQuery.objects) {
                    for (const promptTrigger of prompt.echoTriggers ?? []) {
                      updateTriggerState(triggerRegistry, space, prompt, promptTrigger);
                    }
                  }
                }),
              );

              // Add all chains to the graph.
              const query = space.db.query(ChainType.filter());
              let previousObjects: ChainType[] = [];
              subscriptions.add(
                effect(() => {
                  const removedObjects = previousObjects.filter((object) => !query.objects.includes(object));
                  previousObjects = query.objects;

                  batch(() => {
                    removedObjects.forEach((object) => graph.removeNode(object.id));
                    query.objects.forEach((object) => {
                      graph.addNodes({
                        id: object.id,
                        data: object,
                        properties: {
                          // TODO(wittjosiah): Reconcile with metadata provides.
                          label: object.title || ['object title placeholder', { ns: CHAIN_PLUGIN }],
                          icon: (props: IconProps) => <Brain {...props} />,
                          testId: 'spacePlugin.object',
                          persistenceClass: 'echo',
                          persistenceKey: space?.key.toHex(),
                        },
                      });
                    });
                  });
                }),
              );
            });
          });

          return () => {
            unsubscribe();
            subscriptions.clear();
          };
        },
      },
      stack: {
        creators: [
          {
            id: 'create-stack-section-chain',
            testId: 'chainPlugin.createSectionSpaceChain',
            label: ['create stack section label', { ns: CHAIN_PLUGIN }],
            icon: (props: any) => <Brain {...props} />,
            intent: {
              plugin: CHAIN_PLUGIN,
              action: ChainAction.CREATE,
            },
          },
        ],
      },
      surface: {
        component: ({ data, role }) => {
          switch (role) {
            case 'main':
              return isObject(data.active) ? <ChainMain chain={data.active as ChainType} /> : null;
          }

          return null;
        },
      },
      intent: {
        resolver: (intent) => {
          switch (intent.action) {
            case ChainAction.CREATE: {
              return {
                data: new ChainType(),
              };
            }
          }
        },
      },
    },
  };
};

const updateTriggerState = (
  triggerRegistry: Map<string, () => void>,
  space: Space,
  prompt: ChainType.Prompt,
  promptTrigger: ChainType.EchoTrigger,
) => {
  const existingUnsubscribeFn = triggerRegistry.get(promptTrigger.id);
  const isEnabled = existingUnsubscribeFn != null;
  if (isEnabled === promptTrigger.enabled) {
    return;
  }
  log.info(`${isEnabled ? 'disabling' : 'enabling'} trigger for prompt`, {
    prompt: prompt.command,
    trigger: promptTrigger.typename,
  });

  if (existingUnsubscribeFn) {
    existingUnsubscribeFn();
    triggerRegistry.delete(promptTrigger.id);
    return;
  }

  const unsubscribeFn = SignalTrigger.fromMutations(space)
    .withFilter(Filter.typename(promptTrigger.typename))
    .debounceMs(promptTrigger.debounceMs)
    .unique((prev: any, curr: any) => prev[promptTrigger.compareBy] === curr[promptTrigger.compareBy])
    .create((changedObject: any) => {
      const [thread] = space?.db.query(ThreadType.filter((thread) => !thread.context)).objects ?? [];
      if (!thread) {
        return null;
      }
      return {
        id: PublicKey.random().toHex(),
        kind: 'suggestion',
        metadata: {
          createdMs: Date.now(),
          source: 'plugin-chain',
          spaceKey: space.key.toHex(),
        },
        data: {
          type: 'trigger-prompt',
          value: {
            threadId: thread.id,
            prompt: prompt.command,
            contextObjectId: changedObject.id,
          },
        },
      };
    });
  triggerRegistry.set(promptTrigger.id, unsubscribeFn);
};
