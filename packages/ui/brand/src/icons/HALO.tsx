//
// Copyright 2023 DXOS.org
//

import { IconBase, type IconProps, type IconWeight } from '@phosphor-icons/react';
import React, { forwardRef, type ReactElement } from 'react';

const weights = new Map<IconWeight, ReactElement>([
  [
    'regular',
    <>
      <path d='M95.822,117.241l-64.269,126.05l-6.235,-3.178l65.243,-127.96l3.117,-1.91l65.243,0l0,6.998l-63.099,0Z' />
      <path d='M227.483,241.703l-68.559,-127.96l68.559,127.96Z' />
      <path d='M230.567,240.05l-6.168,3.305l-68.559,-127.96l6.168,-3.305l68.559,127.96Z' />
      <path d='M230.569,240.05l-68.563,-127.96l-6.169,3.305l68.563,127.96l6.169,-3.305Z' />
      <path d='M158.921,113.742l-32.621,56.871' />
      <path d='M155.886,112.001l-32.621,56.871l6.07,3.482l32.621,-56.871l-6.07,-3.482Z' />
      <path d='M184.275,30.24l-21.968,84.384l-6.772,-1.764l25.91,-99.524l6.825,0.237l42.654,227.484l-5.451,3.508l-99.139,-69.652l-95.842,69.62l-5.495,-3.476l42.653,-227.484l6.851,-0.13l22.474,99.013l31.973,55.741l93.513,65.7l-38.186,-203.657Zm-112.86,1.223l-37.92,202.239l88.207,-64.073l-31.059,-54.146l-0.377,-0.967l-18.851,-83.053Z' />
    </>,
  ],
]);

export const HALO = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <IconBase ref={ref} {...props} weights={weights} />
));

HALO.displayName = 'HALO';
