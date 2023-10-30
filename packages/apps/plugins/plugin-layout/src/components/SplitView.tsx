//
// Copyright 2023 DXOS.org
//

import { CaretDoubleLeft, List as MenuIcon } from '@phosphor-icons/react';
import React from 'react';

import { Surface } from '@dxos/app-framework';
import { Button, Main, Dialog, useTranslation, DensityProvider, Popover } from '@dxos/react-ui';
import { baseSurface, coarseBlockSize, getSize, mx } from '@dxos/react-ui-theme';

import { Fallback } from './Fallback';
import { useLayout } from '../LayoutContext';
import { LAYOUT_PLUGIN } from '../types';

export type SplitViewProps = {
  fullscreen?: boolean;
  showComplementarySidebar?: boolean;
};

export const SplitView = ({ fullscreen, showComplementarySidebar = true }: SplitViewProps) => {
  const context = useLayout();
  const { complementarySidebarOpen, dialogOpen, dialogContent, popoverOpen, popoverContent, popoverAnchorId } = context;
  const { t } = useTranslation(LAYOUT_PLUGIN);

  if (fullscreen) {
    return <Surface name='main' role='main' limit={1} />;
  }

  return (
    <Popover.Root
      open={!!(popoverAnchorId && popoverOpen)}
      onOpenChange={(nextOpen) => {
        if (nextOpen && popoverAnchorId) {
          context.popoverOpen = true;
        } else {
          context.popoverOpen = false;
          context.popoverAnchorId = undefined;
        }
      }}
    >
      <div role='none' className='sr-only'>
        <Surface name='documentTitle' role='document-title' limit={1} />
      </div>
      <Main.Root
        navigationSidebarOpen={context.sidebarOpen}
        onNavigationSidebarOpenChange={(next) => (context.sidebarOpen = next)}
        {...(complementarySidebarOpen !== null && {
          complementarySidebarOpen: context.complementarySidebarOpen as boolean,
          onComplementarySidebarOpenChange: (next) => (context.complementarySidebarOpen = next),
        })}
      >
        {/* TODO(burdon): name vs. role? */}

        {/* Left navigation sidebar. */}
        <Main.NavigationSidebar classNames='overflow-hidden'>
          <Surface name='sidebar' role='navigation' />
        </Main.NavigationSidebar>

        {/* Right Complementary sidebar. */}
        {complementarySidebarOpen !== null && showComplementarySidebar && (
          <Main.ComplementarySidebar classNames='overflow-hidden'>
            <Surface name='complementary' role='context' />
          </Main.ComplementarySidebar>
        )}

        {/* Top (header) bar. */}
        <Main.Content
          asChild
          classNames={['fixed inset-inline-0 block-start-0 z-[1] flex gap-1', coarseBlockSize, baseSurface]}
        >
          <div role='none' aria-label={t('main header label')}>
            <DensityProvider density='fine'>
              <Button onClick={() => (context.sidebarOpen = !context.sidebarOpen)} variant='ghost' classNames='mli-1'>
                <span className='sr-only'>{t('open navigation sidebar label')}</span>
                <MenuIcon weight='light' className={getSize(4)} />
              </Button>
              <Surface role='heading' limit={2} />
              <div role='none' className='grow' />
              {/* TODO(burdon): Too specific? status? contentinfo? */}
              <Surface role='presence' limit={1} />
              {complementarySidebarOpen !== null && showComplementarySidebar && (
                <Button
                  onClick={() => (context.complementarySidebarOpen = !context.complementarySidebarOpen)}
                  variant='ghost'
                >
                  <span className='sr-only'>{t('open complementary sidebar label')}</span>
                  <CaretDoubleLeft
                    mirrored={!!context.complementarySidebarOpen}
                    weight='light'
                    className={getSize(4)}
                  />
                </Button>
              )}
            </DensityProvider>
          </div>
        </Main.Content>

        {/* Status info. */}
        {/* TODO(burdon): Currently covered by complementary sidebar. */}
        <div role='none' aria-label={t('status label')} className={mx('fixed bottom-0 right-0 z-[1]')}>
          <Surface role='status' />
        </div>

        {/* Dialog overlay to dismiss dialogs. */}
        <Main.Overlay />

        {/* Main content surface. */}
        <Surface role='main' limit={1} fallback={Fallback} />

        {/* Global popovers. */}
        {/* TODO(burdon): Doesn't allow client to control the popover. */}
        <Popover.Portal>
          <Popover.Content
            classNames='z-[60]'
            onEscapeKeyDown={() => {
              context.popoverOpen = false;
              context.popoverAnchorId = undefined;
            }}
          >
            <Popover.Viewport>
              <Surface role='popover' data={popoverContent} />
            </Popover.Viewport>
            <Popover.Arrow />
          </Popover.Content>
        </Popover.Portal>

        {/* Global dialog. */}
        <Dialog.Root open={dialogOpen} onOpenChange={(nextOpen) => (context.dialogOpen = nextOpen)}>
          <DensityProvider density='fine'>
            <Dialog.Overlay>
              {/* TODO(burdon): Move (thure)[ProfileSettings dialog in particular] dialog to settings-plugin. */}
              {dialogContent.component === 'dxos.org/plugin/layout/ProfileSettings' ? (
                <Dialog.Content>
                  <Dialog.Title>{t('settings dialog title', { ns: 'os' })}</Dialog.Title>
                  {/* TODO(burdon): Standardize layout of section components (e.g., checkbox padding). */}
                  <div className='flex flex-col my-2 gap-4'>
                    <Surface role='settings' data={dialogContent} />
                  </div>
                  <Dialog.Close asChild>
                    <Button variant='primary' classNames='mbs-2'>
                      {t('done label', { ns: 'os' })}
                    </Button>
                  </Dialog.Close>
                </Dialog.Content>
              ) : (
                <Dialog.Content>
                  <Surface role='dialog' data={dialogContent} />
                </Dialog.Content>
              )}
            </Dialog.Overlay>
          </DensityProvider>
        </Dialog.Root>
      </Main.Root>
    </Popover.Root>
  );
};