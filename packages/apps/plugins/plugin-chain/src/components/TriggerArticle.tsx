//
// Copyright 2024 DXOS.org
//

import React, { type FC } from 'react';

import { type FunctionTrigger } from '@dxos/functions/types';
import { getSpace } from '@dxos/react-client/echo';

import { TriggerEditor } from './TriggerEditor';

const TriggerArticle: FC<{ trigger: FunctionTrigger }> = ({ trigger }) => {
  const space = getSpace(trigger);

  if (!space) {
    return null;
  }

  return (
    <div role='none' className={'row-span-2 pli-2'}>
      <TriggerEditor trigger={trigger} space={space} />
    </div>
  );
};

export default TriggerArticle;
