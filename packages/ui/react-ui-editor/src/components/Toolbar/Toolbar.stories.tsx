//
// Copyright 2024 DXOS.org
//

import '@dxosTheme';

import React, { type FC, useState } from 'react';

import { TextType } from '@braneframe/types';
import { create } from '@dxos/echo-schema';
import { PublicKey } from '@dxos/keys';
import { faker } from '@dxos/random';
import { createDocAccessor, createEchoObject } from '@dxos/react-client/echo';
import { Tooltip, useThemeContext } from '@dxos/react-ui';
import { textBlockWidth } from '@dxos/react-ui-theme';
import { withTheme } from '@dxos/storybook-utils';

import { Toolbar } from './Toolbar';
import {
  type Action,
  type Comment,
  comments,
  createBasicExtensions,
  createDataExtensions,
  createMarkdownExtensions,
  createThemeExtensions,
  decorateMarkdown,
  type EditorViewMode,
  formattingKeymap,
  image,
  table,
  useComments,
  useFormattingState,
} from '../../extensions';
import { useActionHandler, useTextEditor } from '../../hooks';
import { editorScroller } from '../../styles';
import translations from '../../translations';

faker.seed(101);

const Story: FC<{ content: string }> = ({ content }) => {
  const { themeMode } = useThemeContext();
  const [text] = useState(createEchoObject(create(TextType, { content })));
  const [formattingState, formattingObserver] = useFormattingState();
  const [viewMode, setViewMode] = useState<EditorViewMode>('preview');
  const { parentRef, view } = useTextEditor(() => {
    return {
      id: text.id,
      initialValue: text.content,
      extensions: [
        formattingObserver,
        createBasicExtensions({ readonly: viewMode === 'readonly' }),
        createMarkdownExtensions({ themeMode }),
        createThemeExtensions({ themeMode, slots: { editor: { className: editorScroller } } }),
        createDataExtensions({ id: text.id, text: createDocAccessor(text, ['content']) }),
        comments({
          onCreate: ({ cursor }) => {
            const id = PublicKey.random().toHex();
            setComments((comments) => [...comments, { id, cursor }]);
            return id;
          },
        }),
        formattingKeymap(),
        image(),
        ...(viewMode !== 'source' ? [decorateMarkdown(), table()] : []),
      ],
    };
  }, [text, formattingObserver, viewMode, themeMode]);

  const handleToolbarAction = useActionHandler(view);
  const handleAction = (action: Action) => {
    if (action.type === 'view-mode') {
      setViewMode(action.data);
    } else {
      handleToolbarAction?.(action);
    }
  };

  const [_comments, setComments] = useState<Comment[]>([]);
  useComments(view, text.id, _comments);

  return (
    <Tooltip.Provider>
      <div role='none' className='fixed inset-0 flex flex-col'>
        <Toolbar.Root onAction={handleAction} state={formattingState} classNames={textBlockWidth}>
          <Toolbar.View mode={viewMode} />
          <Toolbar.Markdown />
          <Toolbar.Custom onUpload={async (file) => ({ url: file.name })} />
          <Toolbar.Separator />
          <Toolbar.Actions />
        </Toolbar.Root>
        <div ref={parentRef} />
      </div>
    </Tooltip.Provider>
  );
};

export default {
  title: 'react-ui-editor/Toolbar',
  component: Toolbar,
  decorators: [withTheme],
  parameters: { translations, layout: 'fullscreen' },
  render: (args: any) => <Story {...args} />,
};

const content = [
  '# Demo',
  '',
  'The editor supports **Markdown** styles.',
  '',
  faker.lorem.paragraph({ min: 5, max: 8 }),
  '',
  '',
].join('\n');

export const Default = {
  args: {
    content,
  },
};
