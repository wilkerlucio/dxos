//
// Copyright 2023 DXOS.org
//

import React from 'react';

import { Grid, type GridRootProps } from './Grid';

const SheetArticle = ({ sheet }: GridRootProps) => {
  return (
    <div role='none' className='group/attention flex flex-col row-span-2 is-full overflow-hidden'>
      <Grid.Root sheet={sheet}>
        <Grid.Main className='border-t' />
      </Grid.Root>
    </div>
  );
};

export default SheetArticle;
