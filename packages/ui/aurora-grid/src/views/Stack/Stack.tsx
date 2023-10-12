//
// Copyright 2023 DXOS.org
//

import React from 'react';

import { mx } from '@dxos/aurora-theme';

import { Mosaic, MosaicContainerProps, MosaicDataItem, useSortedItems } from '../../mosaic';

export type Direction = 'horizontal' | 'vertical';

export type StackProps<TData extends MosaicDataItem = MosaicDataItem> = MosaicContainerProps<TData, number> & {
  items?: TData[];
  direction?: Direction;
  debug?: boolean;
};

// TODO(burdon): Make generic (and forwardRef).
export const Stack = ({
  id,
  Component = Mosaic.DefaultComponent,
  onOver,
  onDrop,
  items = [],
  direction = 'vertical',
  debug,
}: StackProps) => {
  const sortedItems = useSortedItems({ path: id, items });

  return (
    <Mosaic.Container {...{ id, Component, onOver, onDrop }}>
      <Mosaic.SortableContext items={sortedItems} direction={direction}>
        <div className={mx('flex overflow-hidden', direction === 'vertical' && 'w-[300px]')}>
          <div
            className={mx(
              'flex flex-col w-full my-1',
              direction === 'vertical' ? 'overflow-y-auto' : 'overflow-x-auto',
            )}
          >
            <div className={mx('flex', direction === 'vertical' && 'flex-col')}>
              {sortedItems.map((item, index) => (
                <Mosaic.SortableTile
                  key={item.id}
                  item={item}
                  path={id}
                  position={index}
                  Component={Component}
                  className='m-1'
                  // debug={debug}
                />
              ))}
            </div>

            {debug && (
              <div className='grow'>
                <Mosaic.Debug data={{ id, items: sortedItems.length }} />
              </div>
            )}
          </div>
        </div>
      </Mosaic.SortableContext>
    </Mosaic.Container>
  );
};