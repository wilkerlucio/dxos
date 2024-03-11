//
// Copyright 2023 DXOS.org
//

import * as S from '@effect/schema/Schema';

import type {
  GraphBuilderProvides,
  IntentResolverProvides,
  MetadataRecordsProvides,
  SettingsProvides,
  SurfaceProvides,
  TranslationsProvides,
} from '@dxos/app-framework';
import * as E from '@dxos/echo-schema';
import { type ObjectMeta } from '@dxos/react-client/echo';
import { type Extension, type EditorMode } from '@dxos/react-ui-editor';

import { MARKDOWN_PLUGIN } from './meta';
import { EchoReactiveObject } from '@dxos/echo-schema/src/effect/echo-handler';
import { Mutable } from 'effect/Types';

const MARKDOWN_ACTION = `${MARKDOWN_PLUGIN}/action`;

export enum MarkdownAction {
  CREATE = `${MARKDOWN_ACTION}/create`,
  TOGGLE_READONLY = `${MARKDOWN_ACTION}/toggle-readonly`,
}

// TODO(burdon): Remove?
export type MarkdownProperties = {
  title: string;

  // TODO(burdon): Since this is always very precisely an ECHO object why obfuscate it?
  __meta: ObjectMeta;
  readonly?: boolean;
};

export type ExtensionsProvider = (props: { document?: DocumentType }) => Extension[];
export type OnChange = (text: string) => void;

export type MarkdownExtensionProvides = {
  markdown: {
    extensions: ExtensionsProvider;
  };
};

// TODO(wittjosiah): Factor out to graph plugin?
type StackProvides = {
  stack: {
    creators?: Record<string, any>[];
  };
};

// TODO(burdon): Extend view mode per document to include scroll position, etc.
type EditorState = {
  readonly?: boolean;
};

export type MarkdownSettingsProps = {
  state: { [key: string]: EditorState };
  editorMode?: EditorMode;
  experimental?: boolean;
  debug?: boolean;
  toolbar?: boolean;
  typewriter?: string;
};

export type MarkdownPluginProvides = SurfaceProvides &
  IntentResolverProvides &
  GraphBuilderProvides &
  MetadataRecordsProvides &
  SettingsProvides<MarkdownSettingsProps> &
  TranslationsProvides &
  StackProvides;

export const DocumentSchema = S.struct({
  title: S.optional(S.string),
  content: S.optional(S.string),
  comments: S.optional(
    S.struct({
      // TODO(wittjosiah): Add thread schema.
      // thread: S.optional(ThreadSchema),
      cursor: S.optional(S.string),
    }),
  ),
}).pipe(E.echoObject('dxos.sdk.client.Properties', '0.1.0'));

export type DocumentType = EchoReactiveObject<Mutable<S.Schema.To<typeof DocumentSchema>>>;
