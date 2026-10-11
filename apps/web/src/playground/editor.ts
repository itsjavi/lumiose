// CodeMirror 6 views: the `.stsx` editor and the read-only output panes (JavaScript, CSS). Colors
// come from the site's theme custom properties (@lumiose/site-kit), so both follow light and dark.

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { PlaygroundDiagnostic } from "./compiler.ts";
import { stsx, type StyleScanner } from "./stsx-language.ts";

const language = new Compartment();

const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: "var(--lm-syn-keyword)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "var(--lm-syn-string)" },
  {
    tag: [tags.comment, tags.blockComment, tags.lineComment],
    color: "var(--lm-syn-comment)",
    fontStyle: "italic",
  },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit], color: "var(--lm-syn-number)" },
  { tag: [tags.tagName, tags.className, tags.angleBracket], color: "var(--lm-syn-tag)" },
  { tag: [tags.attributeName, tags.typeName, tags.namespace], color: "var(--lm-syn-attr)" },
  {
    tag: [tags.propertyName, tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--lm-syn-prop)",
  },
  {
    tag: [tags.punctuation, tags.separator, tags.bracket, tags.operator],
    color: "var(--lm-syn-punct)",
  },
  { tag: tags.invalid, color: "var(--lm-syn-number)" },
]);

const theme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--lm-code-fg)",
    backgroundColor: "var(--lm-code-bg)",
    fontSize: "0.875rem",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily:
      'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: "1.6",
  },
  ".cm-content": { caretColor: "var(--lm-accent)", paddingBlock: "0.75rem" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--lm-accent)" },
  ".cm-gutters": {
    backgroundColor: "var(--lm-code-bg)",
    color: "var(--lm-subtle)",
    border: "none",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--lm-accent) 6%, transparent)" },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklab, var(--lm-accent) 10%, transparent)",
    color: "var(--lm-text)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--lm-accent) 28%, transparent) !important",
  },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in oklab, var(--lm-accent) 20%, transparent)",
    outline: "none",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--lm-surface)",
    color: "var(--lm-text)",
    border: "1px solid var(--lm-border)",
    borderRadius: "6px",
  },
  ".cm-diagnostic": { fontFamily: "inherit", padding: "0.25rem 0.5rem" },
  ".cm-diagnostic-error": { borderLeftColor: "#e5484d" },
  ".cm-diagnostic-warning": { borderLeftColor: "var(--lm-warn-fg)" },
  ".cm-diagnostic-info": { borderLeftColor: "var(--lm-info-fg)" },
});

const base: Extension = [
  theme,
  syntaxHighlighting(highlightStyle),
  lineNumbers(),
  drawSelection(),
  EditorView.contentAttributes.of({
    spellcheck: "false",
    autocorrect: "off",
    autocapitalize: "off",
  }),
];

/** The `.stsx` editor; `onChange` gets the text after every edit. */
export function createEditor(
  parent: HTMLElement,
  doc: string,
  onChange: (text: string) => void,
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        base,
        language.of(stsx()),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        lintGutter(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        // An explicit tabindex, so checkers see the scroll box's focusable content (axe).
        EditorView.contentAttributes.of({ "aria-label": "App.stsx source", tabindex: "0" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    }),
  });
}

/** Parses style blocks with `scan` (the compiler's scanner) from now on. */
export function setStyleScanner(view: EditorView, scan: StyleScanner): void {
  view.dispatch({ effects: language.reconfigure(stsx(scan)) });
}

/** Replaces the editor's text (a sample, a shared state). */
export function setText(view: EditorView, text: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

/** Shows the compiler's diagnostics in the editor (underlines and gutter markers). */
export function showDiagnostics(view: EditorView, diagnostics: PlaygroundDiagnostic[]): void {
  const length = view.state.doc.length;
  const marks: Diagnostic[] = diagnostics.map((diagnostic) => ({
    from: Math.min(diagnostic.from, length),
    to: Math.min(diagnostic.to, length),
    severity: diagnostic.severity === "hint" ? "info" : diagnostic.severity,
    source: diagnostic.code,
    message: diagnostic.help ? `${diagnostic.message}\n${diagnostic.help}` : diagnostic.message,
  }));
  view.dispatch(setDiagnostics(view.state, marks));
}

/** A read-only view of compiler output. */
export function createOutput(parent: HTMLElement, lang: "js" | "css", label: string): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: "",
      extensions: [
        base,
        lang === "js" ? javascript() : css(),
        EditorState.readOnly.of(true),
        EditorView.contentAttributes.of({ "aria-label": label }),
      ],
    }),
  });
}
