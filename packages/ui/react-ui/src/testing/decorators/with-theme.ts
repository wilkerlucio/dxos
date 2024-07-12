//
// Copyright 2023 DXOS.org
//

import { type Decorator } from '@storybook/react';
import { useEffect, createElement } from 'react';

import { defaultTx } from '@dxos/react-ui-theme';

import { ThemeProvider } from '../../components';

// TODO(burdon): Types.
export const withTheme: Decorator = (StoryFn: any, context: any) => {
  const theme = context?.parameters?.theme || context?.globals?.theme;
  useEffect(() => {
    document.documentElement.classList[theme === 'dark' ? 'add' : 'remove']('dark');
  }, [theme]);

  return createElement(ThemeProvider, {
    children: createElement(StoryFn),
    tx: defaultTx,
  });
};
