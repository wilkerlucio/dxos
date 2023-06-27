//
// Copyright 2023 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { Config, Defaults, Envs, Local } from '@dxos/config';
import {
  Client,
  ClientContext,
  ClientOptions,
  IFrameClientServicesHost,
  IFrameClientServicesProxy,
  SystemStatus,
} from '@dxos/react-client';
import { PluginDefinition } from '@dxos/react-surface';

import { ClientPluginProvides } from './types';

export const ClientPlugin = (
  options: ClientOptions = { config: new Config(Envs(), Local(), Defaults()) },
): PluginDefinition<{}, ClientPluginProvides> => {
  const client = new Client(options);

  return {
    meta: {
      id: 'dxos:client',
    },
    init: async () => {
      await client.initialize();

      return {
        client,
        setLayout: async (layout, options) => {
          if (
            client.services instanceof IFrameClientServicesProxy ||
            client.services instanceof IFrameClientServicesHost
          ) {
            await client.services.setLayout(layout, options);
          }
        },
        context: ({ children }) => {
          const [status, setStatus] = useState<SystemStatus | null>(null);

          useEffect(() => {
            if (!client) {
              return;
            }

            const subscription = client.status.subscribe((status) => setStatus(status));
            return () => subscription.unsubscribe();
          }, [client, setStatus]);

          return <ClientContext.Provider value={{ client, status }}>{children}</ClientContext.Provider>;
        },
      };
    },
    unload: async () => {
      await client.destroy();
    },
  };
};
