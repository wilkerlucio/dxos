//
// Copyright 2024 DXOS.org
//

import React from 'react';

import '@dxosTheme';
import { withTheme } from '@dxos/storybook-utils';

import { osTranslations } from '../../../translations';
import { SpaceManagerWithMoreMembers, SpaceInvitationManagerInit } from '../SpacePanel.stories';

const bgurl = 'https://private-user-images.githubusercontent.com/3398896/332235208-d38415df-e4b4-4429-8d26-7992e9420cec.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTYyNDk5MjksIm5iZiI6MTcxNjI0OTYyOSwicGF0aCI6Ii8zMzk4ODk2LzMzMjIzNTIwOC1kMzg0MTVkZi1lNGI0LTQ0MjktOGQyNi03OTkyZTk0MjBjZWMucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI0MDUyMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNDA1MjFUMDAwMDI5WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9ZTU1YWVkZWFlOTU3NWQwNzhkOGE4MjU0ODQ3OTdjOGY3NjQyMTFmNmNhMWJhYTQzMzRlOTlmODM2YjZlYjgzMSZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QmYWN0b3JfaWQ9MCZrZXlfaWQ9MCZyZXBvX2lkPTAifQ.85rMk9ColwCEmZwIFhq-HTfxPRZU1cycat48Ta_XrM4';

export default {
  title: 'react-shell/SpacePanel',
  decorators: [withTheme],
  parameters: { chromatic: { disableSnapshot: false }, translations: [osTranslations] },
};

export const Marketing = (props: any) => {
  return (
    <div className='p-20 relative flex flex-row justify-between gap-2'>
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat'
        style={{
          filter: 'brightness(1.1) opacity(0.3)',
          backgroundImage: `url(${bgurl})`,
        }}
      ></div>
      <div className='order-2'>
        <SpaceInvitationManagerInit />
      </div>
      <div className='order-1'>
        <SpaceManagerWithMoreMembers />
      </div>
    </div>
  );
};
