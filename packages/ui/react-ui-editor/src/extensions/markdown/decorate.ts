//
// Copyright 2024 DXOS.org
//

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type EditorState, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, WidgetType, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type SyntaxNodeRef } from '@lezer/common';

import { mx } from '@dxos/react-ui-theme';

import { getToken } from '../../styles';

class HorizontalRuleWidget extends WidgetType {
  override toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-hr';
    return el;
  }
}

class LinkButton extends WidgetType {
  constructor(
    private readonly url: string,
    private readonly render: (el: Element, url: string) => void,
  ) {
    super();
  }

  override eq(other: this) {
    return this.url === other.url;
  }

  override toDOM(view: EditorView) {
    const el = document.createElement('span');
    this.render(el, this.url);
    return el;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private _checked: boolean) {
    super();
  }

  override eq(other: this) {
    return this._checked === other._checked;
  }

  override toDOM(view: EditorView) {
    const input = document.createElement('input');
    input.className = 'cm-task-checkbox ch-checkbox ch-focus-ring';
    input.type = 'checkbox';
    input.checked = this._checked;
    if (view.state.readOnly) {
      input.setAttribute('disabled', 'true');
    } else {
      input.onmousedown = (event: Event) => {
        const pos = view.posAtDOM(span);
        const text = view.state.sliceDoc(pos, pos + 3);
        if (text === (this._checked ? '[x]' : '[ ]')) {
          view.dispatch({
            changes: { from: pos + 1, to: pos + 2, insert: this._checked ? ' ' : 'x' },
          });
          event.preventDefault();
        }
      };
    }

    const span = document.createElement('span');
    span.className = 'cm-task';
    span.appendChild(input);
    return span;
  }

  override ignoreEvent() {
    return false;
  }
}

class ListMarkWidget extends WidgetType {
  constructor(
    private readonly className: string,
    private readonly label: string,
  ) {
    super();
  }

  override toDOM() {
    const el = document.createElement('span');
    el.className = this.className;
    el.innerText = this.label;
    return el;
  }
}

const hide = Decoration.replace({});
const fencedCodeLine = Decoration.line({ class: mx('cm-code cm-codeblock-line') });
const fencedCodeLineFirst = Decoration.line({ class: mx('cm-code cm-codeblock-line', 'cm-codeblock-first') });
const fencedCodeLineLast = Decoration.line({ class: mx('cm-code cm-codeblock-line', 'cm-codeblock-last') });
const commentBlockLine = fencedCodeLine;
const commentBlockLineFirst = fencedCodeLineFirst;
const commentBlockLineLast = fencedCodeLineLast;
const horizontalRule = Decoration.replace({ widget: new HorizontalRuleWidget() });
const checkedTask = Decoration.replace({ widget: new CheckboxWidget(true) });
const uncheckedTask = Decoration.replace({ widget: new CheckboxWidget(false) });

// Check if cursor is inside text.
const editingRange = (state: EditorState, range: { from: number; to: number }, focus: boolean) => {
  const {
    readOnly,
    selection: {
      main: { head },
    },
  } = state;
  return focus && !readOnly && head >= range.from && head <= range.to;
};

const MarksByParent = new Set([
  'CodeMark',
  'CodeInfo',
  'EmphasisMark',
  'StrikethroughMark',
  'SubscriptMark',
  'SuperscriptMark',
]);

/**
 * Markdown list level.
 */
type List = { type: string; from: number; to: number; level: number; number: number };

const bulletListIndentationWidth = 24;
const orderedListIndentationWidth = 32; // TODO(burdon): Make variable length based on number of digits.

const buildDecorations = (view: EditorView, options: DecorateOptions, focus: boolean) => {
  const deco = new RangeSetBuilder<Decoration>();
  const atomicDeco = new RangeSetBuilder<Decoration>();
  const { state } = view;

  // State.
  const listLevels: List[] = [];
  // Get the current list based on the node range.
  const getCurrentList = (node: SyntaxNodeRef): List | undefined => {
    let list = listLevels[listLevels.length - 1];
    while (list && node.from >= list.to) {
      listLevels.pop();
      list = listLevels[listLevels.length - 1];
    }

    return list;
  };

  const processNode = (node: SyntaxNodeRef) => {
    switch (node.name) {
      // CommentBlock
      case 'CommentBlock': {
        const editing = editingRange(state, node, focus);
        for (const block of view.viewportLineBlocks) {
          if (block.to < node.from) {
            continue;
          }
          if (block.from > node.to) {
            break;
          }
          const first = block.from <= node.from;
          const last = block.to >= node.to && /^(\s>)*-->$/.test(state.doc.sliceString(block.from, block.to));
          deco.add(
            block.from,
            block.from,
            first ? commentBlockLineFirst : last ? commentBlockLineLast : commentBlockLine,
          );
          if (!editing && (first || last)) {
            atomicDeco.add(block.from, block.to, hide);
          }
        }
        break;
      }

      // FencedCode > CodeMark > [CodeInfo] > CodeText > CodeMark
      case 'FencedCode': {
        for (const block of view.viewportLineBlocks) {
          if (block.to < node.from) {
            continue;
          }
          if (block.from > node.to) {
            break;
          }

          const first = block.from <= node.from;
          const last = block.to >= node.to && /^(\s>)*```$/.test(state.doc.sliceString(block.from, block.to));
          deco.add(block.from, block.from, first ? fencedCodeLineFirst : last ? fencedCodeLineLast : fencedCodeLine);
        }
        return false;
      }

      case 'Link': {
        const marks = node.node.getChildren('LinkMark');
        const urlNode = node.node.getChild('URL');
        const editing = editingRange(state, node, focus);
        if (urlNode && marks.length >= 2) {
          const url = state.sliceDoc(urlNode.from, urlNode.to);
          if (!editing) {
            atomicDeco.add(node.from, marks[0].to, hide);
          }
          deco.add(
            marks[0].to,
            marks[1].from,
            Decoration.mark({
              tagName: 'a',
              attributes: {
                class: 'cm-link',
                href: url,
                rel: 'noreferrer',
                target: '_blank',
              },
            }),
          );
          if (!editing) {
            atomicDeco.add(
              marks[1].from,
              node.to,
              options.renderLinkButton
                ? Decoration.replace({ widget: new LinkButton(url, options.renderLinkButton) })
                : hide,
            );
          }
        }
        break;
      }

      case 'HeaderMark': {
        const parent = node.node.parent!;
        if (/^ATX/.test(parent.name) && !editingRange(state, state.doc.lineAt(node.from), focus)) {
          const next = state.doc.sliceString(node.to, node.to + 1);
          atomicDeco.add(node.from, node.to + (next === ' ' ? 1 : 0), hide);
        }
        break;
      }

      case 'HorizontalRule': {
        if (!editingRange(state, node, focus)) {
          deco.add(node.from, node.to, horizontalRule);
        }
        break;
      }

      case 'BulletList':
      case 'OrderedList': {
        getCurrentList(node);
        listLevels.push({ type: node.name, from: node.from, to: node.to, level: listLevels.length, number: 0 });
        break;
      }

      case 'TaskMarker': {
        if (!editingRange(state, node, focus)) {
          const checked = state.doc.sliceString(node.from + 1, node.to - 1) === 'x';
          atomicDeco.add(node.from - 2, node.from - 1, Decoration.mark({ class: 'cm-task-checkbox' }));
          atomicDeco.add(node.from, node.to, checked ? checkedTask : uncheckedTask);
        }
        break;
      }

      case 'ListItem': {
        // Set indentation.
        const list = getCurrentList(node);
        const width = list?.type === 'OrderedList' ? orderedListIndentationWidth : bulletListIndentationWidth;
        const offset = ((list?.level ?? 0) + 1) * width;
        const start = state.doc.lineAt(node.from);
        deco.add(
          start.from,
          start.from,
          Decoration.line({
            class: 'cm-list-item',
            attributes: {
              // Subtract 0.25em to account for the space CM adds to Paragraph nodes following the ListItem.
              // TODO(burdon): Note: This makes the cursor appear to be left of the margin.
              style: `padding-left: ${offset}px; text-indent: calc(-${width}px - 0.25em);`,
            },
          }),
        );

        // Remove indentation spaces.
        const line = state.doc.sliceString(start.from, node.to);
        const whitespace = line.match(/^ */)?.[0].length ?? 0;
        if (whitespace) {
          deco.add(start.from, start.from + whitespace, Decoration.replace({}));
        }

        break;
      }

      case 'ListMark': {
        // Look-ahead for task marker.
        const task = tree.resolve(node.to + 1, 1).name === 'TaskMarker';
        if (task) {
          deco.add(node.from, node.to, Decoration.replace({}));
          break;
        }

        // TODO(burdon): Cursor stops for 1 character when moving back into number (but not dashes).
        // TODO(burdon): Option to make hierarchical; or a, b, c. etc.
        const list = listLevels[listLevels.length - 1];
        const label = list.type === 'OrderedList' ? `${++list.number}.` : '-';
        deco.add(
          node.from,
          node.to,
          Decoration.replace({
            widget: new ListMarkWidget(
              list.type === 'OrderedList' ? 'cm-list-mark cm-list-mark-ordered' : 'cm-list-mark cm-list-mark-bullet',
              label,
            ),
          }),
        );
        break;
      }

      // NOTE: CM seems to prepend a space to the start of the paragraph.
      case 'Paragraph':
      default: {
        if (MarksByParent.has(node.name)) {
          if (!editingRange(state, node.node.parent!, focus)) {
            atomicDeco.add(node.from, node.to, hide);
          }
        }
      }
    }
  };

  const tree = syntaxTree(state);
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        // console.log(node.name, node.from, node.to);
        processNode(node);
      },
    });
  }

  return { deco: deco.finish(), atomicDeco: atomicDeco.finish() };
};

export interface DecorateOptions {
  renderLinkButton?: (el: Element, url: string) => void;
  /**
   * Prevents triggering decorations as the cursor moves through the document.
   */
  selectionChangeDelay?: number;
}

const forceUpdate = StateEffect.define<null>();

export const decorateMarkdown = (options: DecorateOptions = {}) => {
  return [
    ViewPlugin.fromClass(
      class {
        deco: DecorationSet;
        atomicDeco: DecorationSet;
        pendingUpdate?: NodeJS.Timeout;

        constructor(view: EditorView) {
          ({ deco: this.deco, atomicDeco: this.atomicDeco } = buildDecorations(view, options, view.hasFocus));
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.focusChanged ||
            update.transactions.some((tr) => tr.effects.some((e) => e.is(forceUpdate))) ||
            (update.selectionSet && !options.selectionChangeDelay)
          ) {
            ({ deco: this.deco, atomicDeco: this.atomicDeco } = buildDecorations(
              update.view,
              options,
              update.view.hasFocus,
            ));

            this.clearUpdate();
          } else if (update.selectionSet) {
            this.scheduleUpdate(update.view);
          }
        }

        scheduleUpdate(view: EditorView) {
          this.clearUpdate();
          this.pendingUpdate = setTimeout(() => {
            view.dispatch({ effects: forceUpdate.of(null) });
          }, options.selectionChangeDelay);
        }

        clearUpdate() {
          if (this.pendingUpdate) {
            clearTimeout(this.pendingUpdate);
            this.pendingUpdate = undefined;
          }
        }

        destroy() {
          this.clearUpdate();
        }
      },
      {
        provide: (plugin) => [
          EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomicDeco ?? Decoration.none),
          EditorView.decorations.of((view) => view.plugin(plugin)?.atomicDeco ?? Decoration.none),
          EditorView.decorations.of((view) => view.plugin(plugin)?.deco ?? Decoration.none),
        ],
      },
    ),
    formattingStyles,
  ];
};

const formattingStyles = EditorView.baseTheme({
  '& .cm-code': {
    fontFamily: getToken('fontFamily.mono', []).join(','),
  },

  '& .cm-codeblock-line': {
    paddingInline: '1rem !important',
  },
  '& .cm-codeblock-end': {
    display: 'inline-block',
    width: '100%',
    position: 'relative',
    '&::after': {
      position: 'absolute',
      inset: 0,
      content: '""',
    },
  },
  '& .cm-codeblock-first': {
    borderTopLeftRadius: '.25rem',
    borderTopRightRadius: '.25rem',
  },
  '& .cm-codeblock-last': {
    borderBottomLeftRadius: '.25rem',
    borderBottomRightRadius: '.25rem',
  },
  '&light .cm-codeblock-line, &light .cm-activeLine.cm-codeblock-line': {
    background: getToken('extend.semanticColors.input.light'),
    mixBlendMode: 'darken',
  },
  '&dark .cm-codeblock-line, &dark .cm-activeLine.cm-codeblock-line': {
    background: getToken('extend.semanticColors.input.dark'), // TODO(burdon): Make darker.
    mixBlendMode: 'lighten',
  },

  '& .cm-hr': {
    display: 'inline-block',
    width: '100%',
    height: '0',
    verticalAlign: 'middle',
    borderTop: `1px solid ${getToken('extend.colors.neutral.200')}`,
  },

  '& .cm-task': {
    display: 'inline-block',
    width: `calc(${bulletListIndentationWidth}px - 0.25em)`,
    color: getToken('extend.colors.blue.500'),
  },
  '& .cm-task-checkbox': {
    display: 'grid',
    margin: '0',
    transform: 'translateY(2px)',
  },

  '& .cm-list-item': {},
  '& .cm-list-mark': {
    display: 'inline-block',
    textAlign: 'right',
    color: getToken('extend.colors.neutral.500'),
    fontVariant: 'tabular-nums',
  },
  '& .cm-list-mark-bullet': {
    width: `${bulletListIndentationWidth}px`,
  },
  '& .cm-list-mark-ordered': {
    width: `${orderedListIndentationWidth}px`,
  },
});
