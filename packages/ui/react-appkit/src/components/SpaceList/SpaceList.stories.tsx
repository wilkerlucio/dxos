//
// Copyright 2022 DXOS.org
//

import '@dxosTheme';

import type { StoryFn } from '@storybook/react';
import React from 'react';
import { HashRouter } from 'react-router-dom';

import { ClientProvider, useClient } from '@dxos/react-client';
import { useSpaces } from '@dxos/react-client/echo';
import { ProfileInitializer } from '@dxos/react-client/testing';
import { Button } from '@dxos/react-ui';
import { withTheme } from '@dxos/storybook-utils';

import { SpaceList } from './SpaceList';

export default {
  title: 'react-appkit/SpaceList',
  component: SpaceList,
  decorators: [withTheme],
};

export const Default = {
  render: () => {
    const client = useClient();
    const spaces = useSpaces();

    return (
      <div>
        <Button onClick={() => client.spaces.create()}>Add Space</Button>

        <SpaceList spaces={spaces} />
      </div>
    );
  },
  decorators: [
    (Story: StoryFn) => {
      return (
        <ClientProvider>
          <ProfileInitializer>
            <HashRouter>
              <Story />
            </HashRouter>
          </ProfileInitializer>
        </ClientProvider>
      );
    },
  ],
};
