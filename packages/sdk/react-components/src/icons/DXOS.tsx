//
// Copyright 2021 DXOS.org
//

import React from 'react';

import { SvgIcon } from '@mui/material';

export const PATH = 'M252.498,3.661L250.207,0L127.996,76.278L5.793,0L3.493,3.661L0.035,6.2L88.7,128L0,249.8L3.458,252.339L5.758,256L127.996,179.722L250.207,256L252.498,252.339L256,249.8L167.3,128L256,6.2L252.498,3.661ZM132.319,94.653L156.614,128L132.319,161.347L132.319,94.653ZM123.673,161.347L99.386,128L123.673,94.653L123.673,161.347ZM94.051,120.661L20.093,19.108L121.779,82.582L94.051,120.661ZM121.788,173.418L20.093,236.892L94.051,135.339L121.788,173.418ZM161.966,135.339L235.915,236.892L134.221,173.418L161.966,135.339ZM134.229,82.582L235.915,19.108L161.957,120.661L134.229,82.582Z';

/**
 * Logo
 * NOTE: In Affinity Designer resize (transform) then export with additional properties (flatten transforms).
 */
export const DXOS = (props: any) => (
  <SvgIcon {...props} viewBox='0 0 256 256'>
    <path d={PATH} />
  </SvgIcon>
);
