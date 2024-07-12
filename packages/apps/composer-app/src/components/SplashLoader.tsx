//
// Copyright 2024 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { DXOS } from '@dxos/brand';
import { Status, ThemeProvider } from '@dxos/react-ui';
import { defaultTx, getSize, mx } from '@dxos/react-ui-theme';

export const SplashLoader = () => {
  const [className, setClassName] = useState<string>();
  useEffect(() => {
    setTimeout(() => {
      setClassName('transition duration-1000 scale-100 opacity-25 blur-none');
    }, 100);
  }, []);

  return (
    <ThemeProvider tx={defaultTx}>
      <div className='flex flex-col bs-[100dvh] justify-center items-center'>
        <Status indeterminate aria-label='Initializing' classNames='block is-full' />
        <div className={mx('flex grow items-center scale-50 opacity-0 blur-xl', className)}>
          <DXOS className={getSize(48)} />
        </div>
      </div>
    </ThemeProvider>
  );
};
