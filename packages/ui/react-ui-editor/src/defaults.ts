//
// Copyright 2024 DXOS.org
//

import { EditorView } from '@codemirror/view';

export { getToken } from './styles';

/**
 * CodeMirror content width.
 * 40rem = 640px. Corresponds to initial plank width (Google docs, Stashpad, etc.)
 * 50rem = 800px. Maximum content width for solo mode.
 */
export const editorContent = '!mt-[16px] !mli-auto w-full max-w-[min(50rem,100%-4rem)]';

export const editorWithToolbarLayout =
  'grid grid-cols-1 grid-rows-[min-content_1fr] data-[toolbar=disabled]:grid-rows-[1fr] justify-center content-start overflow-hidden';

export const editorGutter = EditorView.baseTheme({
  '.cm-gutters': {
    // Match margin from content.
    marginTop: '16px',
    // Inside within content margin.
    marginRight: '-32px',
    width: '32px',
    backgroundColor: 'transparent !important',
  },
});
