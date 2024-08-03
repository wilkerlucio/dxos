//
// Copyright 2023 DXOS.org
//

import { Kanban, type IconProps } from '@phosphor-icons/react';
import React from 'react';

import { pluginMeta } from '@dxos/app-framework';

export const KANBAN_PLUGIN = 'dxos.org/plugin/kanban';

export default pluginMeta({
  id: KANBAN_PLUGIN,
  name: 'Kanban',
  description: 'Kanban board for managing tasks.',
  tags: ['experimental'],
  iconComponent: (props: IconProps) => <Kanban {...props} />,
  iconSymbol: 'ph--kanban--regular',
});
