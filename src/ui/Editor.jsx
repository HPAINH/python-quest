import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewlineAndIndent } from '@codemirror/commands';
import { indentUnit, syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword], color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.comment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-func)' },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: 'var(--syn-def)' },
  { tag: [t.standard(t.variableName)], color: 'var(--syn-builtin)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--syn-punct)' },
]);

const setErrorLine = StateEffect.define();
const errorField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (!e.value || e.value < 1 || e.value > tr.state.doc.lines) deco = Decoration.none;
        else {
          const line = tr.state.doc.line(e.value);
          deco = Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)]);
        }
      }
    }
    if (tr.docChanged) deco = Decoration.none;
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--code-ink)', height: '100%' },
  '.cm-content': { fontFamily: 'var(--font-code)', caretColor: 'var(--accent)', padding: '10px 0' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--code-gutter)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)', color: 'var(--code-ink)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--code-selection) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto', lineHeight: '1.6' },
  '.cm-matchingBracket': { backgroundColor: 'var(--code-match)', outline: 'none' },
  '.cm-placeholder': { color: 'var(--code-gutter)' },
});

const Editor = forwardRef(function Editor({ value, onChange, onRun, onCheck, errorLine, readOnly = false, fontSize = 14, minLines = 6, ariaLabel = 'Редактор кода', placeholder = '' }, ref) {
  const host = useRef(null);
  const view = useRef(null);
  const handlers = useRef({ onChange, onRun, onCheck });
  handlers.current = { onChange, onRun, onCheck };
  const sizeComp = useRef(new Compartment());
  const roComp = useRef(new Compartment());

  useImperativeHandle(ref, () => ({
    insert(text) {
      const v = view.current;
      if (!v) return;
      const { from, to } = v.state.selection.main;
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      v.focus();
    },
    focus() { view.current?.focus(); },
  }));

  useEffect(() => {
    const keys = keymap.of([
      { key: 'Mod-Shift-Enter', run: () => { handlers.current.onCheck?.(); return true; } },
      { key: 'Mod-Enter', run: () => { handlers.current.onRun?.(); return true; } },
      { key: 'Enter', run: insertNewlineAndIndent },
      ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab,
    ]);
    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), history(), drawSelection(), bracketMatching(), closeBrackets(), indentOnInput(),
        indentUnit.of('    '), EditorState.tabSize.of(4), python(), syntaxHighlighting(highlight), keys, theme, errorField,
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        sizeComp.current.of(EditorView.theme({ '.cm-content, .cm-gutters': { fontSize: fontSize + 'px', minHeight: minLines * 1.6 * fontSize + 20 + 'px' } })),
        roComp.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        placeholder ? cmPlaceholder(placeholder) : [],
        EditorView.updateListener.of((u) => { if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString()); }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    host.current.__pqView = view.current;
    return () => view.current?.destroy();
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && value !== v.state.doc.toString()) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value || '' } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine || 0) });
  }, [errorLine]);

  useEffect(() => {
    view.current?.dispatch({ effects: sizeComp.current.reconfigure(EditorView.theme({ '.cm-content, .cm-gutters': { fontSize: fontSize + 'px', minHeight: minLines * 1.6 * fontSize + 20 + 'px' } })) });
  }, [fontSize, minLines]);

  useEffect(() => {
    view.current?.dispatch({ effects: roComp.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) });
  }, [readOnly]);

  return <div className="editor" ref={host} />;
});

export default Editor;
