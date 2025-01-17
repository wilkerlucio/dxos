//
// Copyright 2023 DXOS.org
//

import '@dxosTheme';

import { markdown } from '@codemirror/lang-markdown';
import { ArrowSquareOut, X } from '@phosphor-icons/react';
import { effect, useSignal } from '@preact/signals-react';
import defaultsDeep from 'lodash.defaultsdeep';
import React, { type FC, type KeyboardEvent, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { TextType } from '@braneframe/types';
import { create } from '@dxos/echo-schema';
import { keySymbols, parseShortcut } from '@dxos/keyboard';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { faker } from '@dxos/random';
import { createDocAccessor, createEchoObject } from '@dxos/react-client/echo';
import { Button, DensityProvider, Input, ThemeProvider, useThemeContext } from '@dxos/react-ui';
import { baseSurface, defaultTx, mx, getSize } from '@dxos/react-ui-theme';
import { withTheme } from '@dxos/storybook-utils';

import {
  InputModeExtensions,
  annotations,
  autocomplete,
  blast,
  command,
  // commentBlock,
  comments,
  createBasicExtensions,
  createDataExtensions,
  createExternalCommentSync,
  createMarkdownExtensions,
  createThemeExtensions,
  decorateMarkdown,
  defaultOptions,
  dropFile,
  formattingKeymap,
  image,
  linkTooltip,
  listener,
  mention,
  state,
  table,
  typewriter,
  type CommandAction,
  type CommandOptions,
  type Comment,
  type CommentsOptions,
  type SelectionState,
  activeLineGutter,
} from './extensions';
import { useTextEditor, type UseTextEditorProps } from './hooks';
import { editorScroller } from './styles';
import translations from './translations';

faker.seed(101);

const str = (...lines: string[]) => lines.join('\n');

const num = () => faker.number.int({ min: 0, max: 9999 }).toLocaleString();

const img = '![dxos](https://pbs.twimg.com/profile_banners/1268328127673044992/1684766689/1500x500)';

const content = {
  tasks: str(
    //
    '## Tasks',
    '',
    `- [x] ${faker.lorem.sentences()}`,
    `- [ ] ${faker.lorem.sentences()}`,
    `  - [ ] ${faker.lorem.sentences()}`,
    `    - [ ] ${faker.lorem.sentences()}`,
    `    - [x] ${faker.lorem.sentences()}`,
    '',
  ),

  bullets: str(
    //
    '## List',
    '',
    `- ${faker.lorem.sentences()}`,
    `- ${faker.lorem.sentences()}`,
    `  - ${faker.lorem.sentences()}`,
    `  - ${faker.lorem.sentences()}`,
    `- ${faker.lorem.sentences()}`,
    '',
  ),

  numbered: str(
    //
    '## Numbered (part 1)',
    '',
    `1. ${faker.lorem.sentences()}`,
    `1. ${faker.lorem.sentences()}`,
    `1. ${faker.lorem.sentences()}`,
    `    1. ${faker.lorem.sentences()}`,
    `    1. ${faker.lorem.sentences()}`,
    `        1. ${faker.lorem.sentences()}`,
    `1. ${faker.lorem.sentences()}`,
    '',
    '## Numbered (part 2)',
    '',
    `1. ${faker.lorem.sentences()}`,
    '',
  ),

  code: str(
    '## Code',
    '',
    '```',
    '$ ls -las',
    '```',
    '',
    '```tsx',
    'const Component = () => {',
    '  const x = 100;',
    '',
    '  return () => <div>Test</div>;',
    '};',
    '```',
    '',
  ),

  comment: str('<!--', 'A comment', '-->', '', 'No comment.', 'Partial comment. <!-- comment. -->'),

  links: str(
    '## Links',
    '',
    'This is a naked link https://dxos.org within a sentence.',
    '',
    'Take a look at [DXOS](https://dxos.org) and how to [get started](https://docs.dxos.org/guide/getting-started.html).',
    '',
  ),

  table: str(
    '# Table',
    '',
    `| ${faker.lorem.word().padStart(12)} | ${faker.lorem.word().padStart(12)} | ${faker.lorem.word().padStart(12)} |`,
    `|-${''.padStart(12, '-')}-|-${''.padStart(12, '-')}-|-${''.padStart(12, '-')}-|`,
    `| ${num().padStart(12)} | ${num().padStart(12)} | ${num().padStart(12)} |`,
    `| ${num().padStart(12)} | ${num().padStart(12)} | ${num().padStart(12)} |`,
    `| ${num().padStart(12)} | ${num().padStart(12)} | ${num().padStart(12)} |`,
    '',
  ),

  image: str('# Image', '', img),

  headings: str(
    ...[1, 2, 3, 4, 5, 6].map((level) => ['#'.repeat(level) + ` Heading ${level}`, faker.lorem.sentences(), '']).flat(),
  ),

  paragraphs: str(...faker.helpers.multiple(() => [faker.lorem.paragraph(), ''], { count: 3 }).flat()),

  footer: str('', '', '', '', ''),
};

const text = str(
  '# Markdown',
  '',
  '> This is a block quote.',
  '',
  '> This is a long wrapping block quote. Neque reiciendis ullam quae error labore sit, at, et, nulla, aut at nostrum omnis quas nostrum, at consectetur vitae eos asperiores non omnis ullam in beatae at vitae deserunt asperiores sapiente.',
  '',
  '> This is',
  '> a multi-line',
  '> block quote.',
  '',
  'This is all about https://dxos.org and related technologies.',
  '',
  'This this is **bold**, ~~strikethrough~~, _italic_, and `f(INLINE)`.',
  '',
  '---',
  content.links,
  '---',
  content.bullets,
  '---',
  content.tasks,
  '---',
  content.numbered,
  '---',
  content.code,
  '---',
  content.headings,
  '---',
  content.table,
  '---',
  content.image,
  content.footer,
);

const links = [
  { label: 'DXOS', apply: '[DXOS](https://dxos.org)' },
  { label: 'GitHub', apply: '[DXOS GitHub](https://github.com/dxos)' },
  { label: 'Automerge', apply: '[Automerge](https://automerge.org/)' },
  { label: 'IPFS', apply: '[Protocol Labs](https://docs.ipfs.tech)' },
  { label: 'StackEdit', apply: '[StackEdit](https://stackedit.io/app)' },
];

const names = ['adam', 'alice', 'alison', 'bob', 'carol', 'charlie', 'sayuri', 'shoko'];

const hover =
  'rounded-sm text-base text-primary-600 hover:text-primary-500 dark:text-primary-300 hover:dark:text-primary-200';

const renderLinkTooltip = (el: Element, url: string) => {
  const web = new URL(url);
  createRoot(el).render(
    <StrictMode>
      <a href={url} target='_blank' rel='noreferrer' className={hover}>
        {web.origin}
        <ArrowSquareOut weight='bold' className={mx(getSize(4), 'inline-block leading-none mis-1')} />
      </a>
    </StrictMode>,
  );
};

const Key: FC<{ char: string }> = ({ char }) => (
  <span className='flex justify-center items-center w-[24px] h-[24px] rounded text-xs bg-neutral-200 text-black'>
    {char}
  </span>
);

const onCommentsHover: CommentsOptions['onHover'] = (el, shortcut) => {
  createRoot(el).render(
    <StrictMode>
      <div className='flex items-center gap-2 px-2 py-2 bg-neutral-700 text-white text-xs rounded'>
        <div>Create comment</div>
        <div className='flex gap-1'>
          {keySymbols(parseShortcut(shortcut)).map((char) => (
            <Key key={char} char={char} />
          ))}
        </div>
      </div>
    </StrictMode>,
  );
};

const renderLinkButton = (el: Element, url: string) => {
  createRoot(el).render(
    <StrictMode>
      <a href={url} target='_blank' rel='noreferrer' className={hover}>
        <ArrowSquareOut weight='bold' className={mx(getSize(4), 'inline-block leading-none mis-1 mb-[2px]')} />
      </a>
    </StrictMode>,
  );
};

//
// Story
//

type StoryProps = {
  id?: string;
  text?: string;
  readonly?: boolean;
  placeholder?: string;
} & Pick<UseTextEditorProps, 'selection' | 'extensions'>;

const Story = ({
  id = 'editor-' + PublicKey.random().toHex().slice(0, 8),
  text,
  extensions = [],
  readonly,
  placeholder = 'New document.',
  selection,
}: StoryProps) => {
  const [object] = useState(createEchoObject(create(TextType, { content: text ?? '' })));
  const { themeMode } = useThemeContext();
  const { parentRef, focusAttributes } = useTextEditor(
    () => ({
      id,
      initialValue: text,
      extensions: [
        createBasicExtensions({ readonly, placeholder }),
        createMarkdownExtensions({ themeMode }),
        createThemeExtensions({
          themeMode,
          slots: {
            editor: {
              className: editorScroller,
            },
          },
        }),
        createDataExtensions({ id, text: createDocAccessor(object, ['content']) }),
        extensions,
      ],
      selection,
    }),
    [object, extensions, themeMode],
  );

  return <div role='none' ref={parentRef} className={mx('min-bs-dvh')} {...focusAttributes} />;
};

export default {
  title: 'react-ui-editor/TextEditor',
  decorators: [withTheme],
  render: Story,
  parameters: { translations, layout: 'fullscreen' },
};

const defaults = [
  autocomplete({
    onSearch: (text) => links.filter(({ label }) => label.toLowerCase().includes(text.toLowerCase())),
  }),
  decorateMarkdown({ renderLinkButton, selectionChangeDelay: 100 }),
  formattingKeymap(),
  image(),
  table(),
  linkTooltip(renderLinkTooltip),
];

export const Default = {
  render: () => <Story text={text} extensions={defaults} />,
};

export const Readonly = {
  render: () => <Story text={text} extensions={defaults} readonly />,
};

export const NoExtensions = {
  render: () => <Story text={text} />,
};

export const Gutter = {
  render: () => <Story text={text} extensions={[...defaults, activeLineGutter]} />,
};

// TODO(burdon): This doesn't work inside widgets.
export const GutterIcon = {
  render: () => (
    <div className='flex p-2'>
      <svg className={getSize(4)}>
        <use href='/icons.svg#ph--caret-right--regular' />
      </svg>
    </div>
  ),
};

const large = faker.helpers.multiple(() => faker.lorem.paragraph({ min: 8, max: 16 }), { count: 20 }).join('\n\n');

const largeWithImages = faker.helpers
  .multiple(() => [faker.lorem.paragraph({ min: 12, max: 16 }), img], { count: 20 })
  .flatMap((x) => x)
  .join('\n\n');

export const Empty = {
  render: () => <Story />,
};

const global = new Map<string, SelectionState>();

export const Scrolling = {
  render: () => (
    <Story
      text={str('# Large Document', '', large)}
      extensions={state({
        setState: (id, state) => global.set(id, state),
        getState: (id) => global.get(id),
      })}
    />
  ),
};

export const ScrollingWithImages = {
  render: () => <Story text={str('# Large Document', '', largeWithImages)} extensions={[image()]} />,
};

export const Links = {
  render: () => <Story text={str(content.links, content.footer)} extensions={[linkTooltip(renderLinkTooltip)]} />,
};

export const Image = {
  render: () => <Story text={str(content.image, content.footer)} extensions={[image()]} />,
};

export const Code = {
  render: () => <Story text={str(content.code, content.footer)} extensions={[decorateMarkdown()]} />,
};

export const Lists = {
  render: () => (
    <Story
      text={str(content.tasks, '', content.bullets, '', content.numbered, content.footer)}
      extensions={[decorateMarkdown()]}
    />
  ),
};

export const Bullets = {
  render: () => <Story text={str(content.bullets, content.footer)} extensions={[decorateMarkdown()]} />,
};

export const Numbered = {
  render: () => <Story text={str(content.numbered, content.footer)} extensions={[decorateMarkdown()]} />,
};

export const Tasks = {
  render: () => <Story text={str(content.tasks, content.footer)} extensions={[decorateMarkdown()]} />,
};

export const Table = {
  render: () => <Story text={str(content.table, content.footer)} extensions={[table()]} />,
};

export const Autocomplete = {
  render: () => (
    <Story
      text={str('# Autocomplete', '', 'Press Ctrl-Space...', content.footer)}
      extensions={[
        decorateMarkdown({ renderLinkButton }),
        autocomplete({
          onSearch: (text) => links.filter(({ label }) => label.toLowerCase().includes(text.toLowerCase())),
        }),
      ]}
    />
  ),
};

export const CommentedOut = {
  render: () => (
    <Story
      text={str('# Commented out', '', content.comment, content.footer)}
      extensions={[
        decorateMarkdown(),
        markdown(),
        // commentBlock()
      ]}
    />
  ),
};

export const Mention = {
  render: () => (
    <Story
      text={str('# Mention', '', 'Type @...', content.footer)}
      extensions={[
        mention({
          onSearch: (text) => names.filter((name) => name.toLowerCase().startsWith(text.toLowerCase())),
        }),
      ]}
    />
  ),
};

const CommandDialog: FC<{ onClose: (action?: CommandAction) => void }> = ({ onClose }) => {
  const [text, setText] = useState('');
  const handleInsert = () => {
    onClose(text.length ? { insert: text + '\n' } : undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Enter': {
        handleInsert();
        break;
      }
      case 'Escape': {
        onClose();
        break;
      }
    }
  };

  return (
    <DensityProvider density='fine'>
      <div className={mx('flex items-center p-2 gap-2 border rounded-md', baseSurface)}>
        <Input.Root>
          <Input.TextInput
            autoFocus={true}
            placeholder='Enter command.'
            value={text}
            onChange={({ target: { value } }) => setText(value)}
            onKeyDown={handleKeyDown}
          />
        </Input.Root>
        <Button variant='ghost' classNames='pli-0' onClick={() => onClose()}>
          <X className={getSize(5)} />
        </Button>
      </div>
    </DensityProvider>
  );
};

const renderCommandDialog: CommandOptions['onRender'] = (el, onClose) => {
  createRoot(el).render(
    <StrictMode>
      <ThemeProvider tx={defaultTx}>
        <CommandDialog onClose={onClose} />
      </ThemeProvider>
    </StrictMode>,
  );
};

export const Command = {
  render: () => (
    <Story
      text={str('# Command', '')}
      extensions={[command({ onRender: renderCommandDialog, onHint: () => 'Press / for commands.' })]}
    />
  ),
};

export const Comments = {
  render: () => {
    const _comments = useSignal<Comment[]>([]);
    return (
      <Story
        text={str('# Comments', '', content.paragraphs, content.footer)}
        extensions={[
          createExternalCommentSync(
            'test',
            (sink) => effect(() => sink()),
            () => _comments.value,
          ),
          comments({
            id: 'test',
            onHover: onCommentsHover,
            onCreate: ({ cursor }) => {
              const id = PublicKey.random().toHex();
              _comments.value = [..._comments.value, { id, cursor }];
              return id;
            },
            onSelect: (state) => {
              const debug = false;
              if (debug) {
                console.log(
                  'update',
                  JSON.stringify({
                    comments: state.comments.length,
                    active: state.selection.current?.slice(0, 8),
                    closest: state.selection.closest?.slice(0, 8),
                  }),
                );
              }
            },
          }),
        ]}
      />
    );
  },
};

export const Vim = {
  render: () => (
    <Story
      text={str('# Vim Mode', '', 'The distant future. The year 2000.', '', content.paragraphs)}
      extensions={[defaults, InputModeExtensions.vim]}
    />
  ),
};

export const Annotations = {
  render: () => <Story text={str('# Annotations', '', large)} extensions={[annotations({ match: /volup/gi })]} />,
};

export const DND = {
  render: () => (
    <Story
      text={str('# DND', '')}
      extensions={[
        dropFile({
          onDrop: (view, event) => {
            log.info('drop', event);
          },
        }),
      ]}
    />
  ),
};

const typewriterItems = localStorage.getItem('dxos.org/plugin/markdown/typewriter')?.split(',');

export const Listener = {
  render: () => (
    <Story
      text={str('# Listener', '', content.footer)}
      extensions={[
        listener({
          onFocus: (focusing) => {
            console.log({ focusing });
          },
          onChange: (text) => {
            console.log({ text });
          },
        }),
      ]}
    />
  ),
};

export const Typewriter = {
  render: () => (
    <Story
      text={str('# Typewriter', '', content.paragraphs, content.footer)}
      extensions={[typewriter({ items: typewriterItems })]}
    />
  ),
};

export const Blast = {
  render: () => (
    <Story
      text={str('# Blast', '', content.paragraphs, content.code, content.paragraphs)}
      extensions={[
        typewriter({ items: typewriterItems }),
        blast(
          defaultsDeep(
            {
              effect: 2,
              particleGravity: 0.2,
              particleShrinkRate: 0.995,
              color: () => [faker.number.int({ min: 100, max: 200 }), 0, 0],
              // color: () => [faker.number.int(256), faker.number.int(256), faker.number.int(256)],
            },
            defaultOptions,
          ),
        ),
      ]}
    />
  ),
};
