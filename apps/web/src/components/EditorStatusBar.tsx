// FILE: EditorStatusBar.tsx
// Purpose: VS Code-style status bar that sits at the bottom of the Monaco
//          file editor, surfacing cursor position, selection info, language,
//          encoding, EOL mode, indentation, and problem counts.
// Layer: Editor UI
// Exports: EditorStatusBar

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Language display name mapping
// ---------------------------------------------------------------------------

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  jsonc: "JSON with Comments",
  markdown: "Markdown",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  html: "HTML",
  xml: "XML",
  yaml: "YAML",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  go: "Go",
  java: "Java",
  c: "C",
  cpp: "C++",
  swift: "Swift",
  kotlin: "Kotlin",
  dart: "Dart",
  php: "PHP",
  shell: "Shell Script",
  sql: "SQL",
  graphql: "GraphQL",
  ini: "INI",
  plaintext: "Plain Text",
};

function formatLanguage(raw: string): string {
  return LANGUAGE_DISPLAY_NAMES[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorStatusBarProps {
  editor: editor.IStandaloneCodeEditor | null;
  language: string;
  filePath: string;
}

interface CursorInfo {
  lineNumber: number;
  column: number;
}

interface SelectionInfo {
  /** null when nothing meaningful is selected */
  text: string | null;
}

interface MarkerCounts {
  errors: number;
  warnings: number;
}

interface IndentInfo {
  insertSpaces: boolean;
  tabSize: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEolLabel(model: editor.ITextModel): string {
  const eol = model.getEOL();
  return eol === "\r\n" ? "CRLF" : "LF";
}

function getIndentInfo(model: editor.ITextModel): IndentInfo {
  const opts = model.getOptions();
  return {
    insertSpaces: opts.insertSpaces,
    tabSize: opts.tabSize,
  };
}

function formatIndent(info: IndentInfo): string {
  return info.insertSpaces ? `Spaces: ${info.tabSize}` : `Tabs: ${info.tabSize}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EditorStatusBar = memo(function EditorStatusBar({
  editor: editorInstance,
  language,
  filePath,
}: EditorStatusBarProps) {
  const [cursor, setCursor] = useState<CursorInfo>({ lineNumber: 1, column: 1 });
  const [selection, setSelection] = useState<SelectionInfo>({ text: null });
  const [markers, setMarkers] = useState<MarkerCounts>({ errors: 0, warnings: 0 });
  const [eol, setEol] = useState("LF");
  const [indent, setIndent] = useState<IndentInfo>({ insertSpaces: true, tabSize: 2 });

  // We need a stable ref to the Monaco global so we can access `monaco.editor`
  // for marker APIs outside the effect closure.
  const monacoGlobalRef = useRef<typeof import("monaco-editor") | null>(null);

  // ------------------------------------------------------------------
  // Compute marker counts from the current model
  // ------------------------------------------------------------------
  const refreshMarkers = useCallback(() => {
    const monacoGlobal = monacoGlobalRef.current;
    const model = editorInstance?.getModel();
    if (!monacoGlobal || !model) return;

    const allMarkers = monacoGlobal.editor.getModelMarkers({ resource: model.uri });
    let errors = 0;
    let warnings = 0;
    for (const m of allMarkers) {
      // MarkerSeverity: 1=Hint, 2=Info, 4=Warning, 8=Error
      if (m.severity === 8) errors++;
      else if (m.severity === 4) warnings++;
    }
    setMarkers({ errors, warnings });
  }, [editorInstance]);

  // ------------------------------------------------------------------
  // Read model-level state (EOL, indentation) whenever model changes
  // ------------------------------------------------------------------
  const syncModelState = useCallback(() => {
    const model = editorInstance?.getModel();
    if (!model) return;
    setEol(getEolLabel(model));
    setIndent(getIndentInfo(model));
  }, [editorInstance]);

  // ------------------------------------------------------------------
  // Subscribe to Monaco events
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!editorInstance) return;

    // Grab the Monaco global from the editor instance. The CDN loader
    // (`@monaco-editor/react`) exposes it through `window.monaco`.
    const win = window as unknown as { monaco?: typeof import("monaco-editor") };
    if (win.monaco) {
      monacoGlobalRef.current = win.monaco;
    }

    const disposables: { dispose(): void }[] = [];

    // Cursor position
    disposables.push(
      editorInstance.onDidChangeCursorPosition((e) => {
        setCursor({ lineNumber: e.position.lineNumber, column: e.position.column });
      }),
    );

    // Selection info
    disposables.push(
      editorInstance.onDidChangeCursorSelection((e) => {
        const sel = e.selection;
        const secondaryCount = e.secondarySelections.length;

        // Multi-cursor: report total cursor count
        if (secondaryCount > 0) {
          setSelection({ text: `${secondaryCount + 1} selected` });
          return;
        }

        // Single selection — check if anything is actually selected
        if (sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn) {
          setSelection({ text: null });
          return;
        }

        const model = editorInstance.getModel();
        if (!model) {
          setSelection({ text: null });
          return;
        }

        const selectedText = model.getValueInRange(sel);
        const charCount = selectedText.length;
        setSelection({ text: `${charCount} character${charCount !== 1 ? "s" : ""} selected` });
      }),
    );

    // Model content changes may affect EOL / indent detection
    const model = editorInstance.getModel();
    if (model) {
      disposables.push(
        model.onDidChangeOptions(() => {
          syncModelState();
        }),
      );
    }

    // Markers
    const monacoGlobal = monacoGlobalRef.current;
    if (monacoGlobal) {
      disposables.push(
        monacoGlobal.editor.onDidChangeMarkers(() => {
          refreshMarkers();
        }),
      );
    }

    // Initial sync
    syncModelState();
    refreshMarkers();

    return () => {
      for (const d of disposables) d.dispose();
    };
  }, [editorInstance, refreshMarkers, syncModelState]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const displayLanguage = formatLanguage(language);
  const indentLabel = formatIndent(indent);

  return (
    <div
      className={cn(
        "editor-status-bar",
        "flex h-[22px] shrink-0 items-center justify-between border-t border-border/40",
        "bg-[var(--color-background-surface)] px-2 text-[11px] text-muted-foreground",
      )}
      style={{ fontFamily: "var(--font-chat-code-family, ui-monospace, monospace)" }}
    >
      {/* ---- Left side: problems ---- */}
      <div className="flex items-center gap-2">
        <div
          id="synara-vim-status"
          className="px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider empty:hidden shrink-0"
        />
        <button
          type="button"
          className="flex cursor-default items-center gap-1.5 rounded px-1 py-0.5 hover:bg-foreground/[0.06]"
          title={`${markers.errors} error${markers.errors !== 1 ? "s" : ""}, ${markers.warnings} warning${markers.warnings !== 1 ? "s" : ""}`}
        >
          <span
            className={cn("flex items-center gap-0.5", markers.warnings > 0 && "text-yellow-500")}
          >
            ⚠ {markers.warnings}
          </span>
          <span className={cn("flex items-center gap-0.5", markers.errors > 0 && "text-red-400")}>
            ✕ {markers.errors}
          </span>
        </button>
      </div>

      {/* ---- Right side: cursor, selection, indent, encoding, eol, language ---- */}
      <div className="flex items-center">
        {/* Cursor position */}
        <StatusBarItem title={`Line ${cursor.lineNumber}, Column ${cursor.column}`}>
          Ln {cursor.lineNumber}, Col {cursor.column}
        </StatusBarItem>

        {/* Selection (only shown when active) */}
        {selection.text != null && (
          <StatusBarItem title={selection.text}>{selection.text}</StatusBarItem>
        )}

        {/* Indentation */}
        <StatusBarItem title={`Indentation: ${indentLabel}`}>{indentLabel}</StatusBarItem>

        {/* Encoding */}
        <StatusBarItem title="Encoding">UTF-8</StatusBarItem>

        {/* EOL */}
        <StatusBarItem title="End-of-line sequence">{eol}</StatusBarItem>

        {/* Language */}
        <StatusBarItem title={`Language: ${displayLanguage} (${filePath})`}>
          {displayLanguage}
        </StatusBarItem>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Small sub-component for individual status bar items
// ---------------------------------------------------------------------------

function StatusBarItem({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="cursor-default rounded px-1.5 py-0.5 hover:bg-foreground/[0.06]"
    >
      {children}
    </button>
  );
}
