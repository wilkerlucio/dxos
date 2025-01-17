//
// Copyright 2023 DXOS.org
//

import { Check, Play, Warning } from '@phosphor-icons/react';
// @ts-ignore
import esbuildWasmURL from 'esbuild-wasm/esbuild.wasm?url';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { type ScriptType } from '@braneframe/types';
import { createDocAccessor, DocAccessor } from '@dxos/react-client/echo';
import { DensityProvider, Toolbar, Button } from '@dxos/react-ui';
import { mx, getSize } from '@dxos/react-ui-theme';

import { FrameContainer } from './FrameContainer';
import { Splitter, SplitterSelector, type View } from './Splitter';
import { Compiler, type CompilerResult, initializeCompiler } from '../../compiler';
import { ScriptEditor } from '../ScriptEditor';

// Keep in sync with packages/apps/composer-app/script-frame/main.tsx .
const PROVIDED_MODULES = [
  'react',
  'react-dom/client',
  '@dxos/client',
  '@dxos/react-client',
  '@dxos/react-client/echo',
  '@braneframe/plugin-explorer',
  '@braneframe/types',
];

export type ScriptBlockProps = {
  script: ScriptType;
  view?: View;
  hideSelector?: boolean;
  classes?: {
    root?: string;
    toolbar?: string;
  };

  // Url to the page used to host the script in the iframe.
  containerUrl: string;
};

/**
 * @deprecated
 */
// TODO(burdon): Cache compiled results in context.
export const ScriptBlock = ({
  script,
  view: controlledView,
  hideSelector,
  classes,
  containerUrl,
}: ScriptBlockProps) => {
  const source = useMemo(() => script.source && createDocAccessor(script.source, ['content']), [script.source]);
  const [view, setView] = useState<View>(controlledView ?? 'editor');
  useEffect(() => handleSetView(controlledView ?? 'editor'), [controlledView]);

  const [result, setResult] = useState<CompilerResult>();
  const compiler = useMemo(() => new Compiler({ platform: 'browser', providedModules: PROVIDED_MODULES }), []);
  useEffect(() => {
    // TODO(burdon): Create useCompiler hook (with initialization).
    void initializeCompiler({ wasmURL: esbuildWasmURL });
  }, []);
  useEffect(() => {
    // TODO(burdon): Throttle and listen for update.
    const t = setTimeout(async () => {
      if (!source) {
        return;
      }

      const result = await compiler.compile(DocAccessor.getValue(source));
      setResult(result);
    });

    return () => clearTimeout(t);
  }, [source]);

  const handleSetView = useCallback(
    (view: View) => {
      setView(view);
      if (!result && view !== 'editor') {
        void handleExec(false);
      }
    },
    [result],
  );

  const handleExec = useCallback(
    async (auto = true) => {
      if (!source) {
        return;
      }
      const result = await compiler.compile(DocAccessor.getValue(source));
      setResult(result);
      if (auto && view === 'editor') {
        setView('preview');
      }
    },
    [source, view],
  );

  return (
    <div className={mx('flex flex-col grow overflow-hidden', classes?.root)}>
      {!hideSelector && (
        <DensityProvider density='fine'>
          <Toolbar.Root classNames={mx('mb-2', classes?.toolbar)}>
            <SplitterSelector view={view} onChange={handleSetView} />
            <div className='grow' />
            {result?.bundle && !result?.error && (
              <div title={String(result.error)}>
                <Check className={mx(getSize(5), 'text-green-500')} />
              </div>
            )}
            {result?.error && (
              <div title={String(result.error)}>
                <Warning className={mx(getSize(5), 'text-orange-500')} />
              </div>
            )}
            <Button variant='ghost' onClick={() => handleExec()}>
              <Play className={getSize(5)} />
            </Button>
          </Toolbar.Root>
        </DensityProvider>
      )}

      <Splitter view={view}>
        <ScriptEditor script={script} />
        {result && <FrameContainer key={script.id} result={result} containerUrl={containerUrl} />}
      </Splitter>
    </div>
  );
};
