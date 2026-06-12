import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "~/hooks/useTheme";
import { useProjectWriteFile } from "~/lib/projectReactQuery";
import { basenameOfPath } from "~/file-icons";
import { FileEntryIcon } from "./chat/FileEntryIcon";
import { ChatHeaderIconButton } from "./chat/chatHeaderControls";
import { XIcon } from "~/lib/icons";

interface MonacoFileEditorProps {
  filePath: string;
  contents: string;
  workspaceRoot: string;
  onClose: () => void;
}

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    jsonc: "json",
    md: "markdown",
    mdx: "markdown",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    xml: "xml",
    svg: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    swift: "swift",
    kt: "kotlin",
    dart: "dart",
    php: "php",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    toml: "plaintext",
    ini: "ini",
    cfg: "ini",
    env: "plaintext",
    gitignore: "plaintext",
    dockerfile: "plaintext",
    lock: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

function normalizeMonacoModelPath(workspaceRoot: string, filePath: string): string {
  const encodedRoot = encodeURIComponent(workspaceRoot.replaceAll("\\", "/").replace(/\/+$/u, ""));
  const normalizedFilePath = filePath.replaceAll("\\", "/").replace(/^\/+/u, "");
  return `/synara/${encodedRoot || "workspace"}/${normalizedFilePath}`;
}

const configureMonacoBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("synara-editor-dark", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "d8d8d9" },
      { token: "comment", foreground: "6f7781" },
      { token: "keyword", foreground: "ff7a90" },
      { token: "string", foreground: "8fc7ff" },
      { token: "number", foreground: "f2a65e" },
      { token: "regexp", foreground: "8fc7ff" },
      { token: "type", foreground: "b99aff" },
      { token: "class", foreground: "b99aff" },
      { token: "interface", foreground: "b99aff" },
      { token: "function", foreground: "8fc7ff" },
      { token: "identifier", foreground: "d8d8d9" },
      { token: "variable", foreground: "d8d8d9" },
      { token: "variable.predefined", foreground: "8fc7ff" },
      { token: "delimiter", foreground: "d8d8d9" },
      { token: "operator", foreground: "d8d8d9" },
      { token: "tag", foreground: "8fc7ff" },
      { token: "attribute.name", foreground: "b99aff" },
    ],
    colors: {
      "editor.background": "#101011",
      "editor.foreground": "#d8d8d9",
      "editorLineNumber.foreground": "#4f5359",
      "editorLineNumber.activeForeground": "#6a6f77",
      "editorCursor.foreground": "#d7d7d8",
      "editor.selectionBackground": "#2b5f8a66",
      "editor.inactiveSelectionBackground": "#2b5f8a33",
      "editor.selectionHighlightBackground": "#00000000",
      "editor.wordHighlightBackground": "#00000000",
      "editor.wordHighlightStrongBackground": "#00000000",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#2d3034",
      "editorIndentGuide.activeBackground1": "#3d4248",
      "editorOverviewRuler.border": "#00000000",
      "scrollbarSlider.background": "#ffffff1a",
      "scrollbarSlider.hoverBackground": "#ffffff26",
      "scrollbarSlider.activeBackground": "#ffffff33",
    },
    semanticHighlighting: false,
  });

  monaco.editor.defineTheme("synara-editor-light", {
    base: "vs",
    inherit: false,
    rules: [
      { token: "", foreground: "242629" },
      { token: "comment", foreground: "7a828c" },
      { token: "keyword", foreground: "c73552" },
      { token: "string", foreground: "1f6fb2" },
      { token: "number", foreground: "a95f00" },
      { token: "regexp", foreground: "1f6fb2" },
      { token: "type", foreground: "7c55c7" },
      { token: "class", foreground: "7c55c7" },
      { token: "interface", foreground: "7c55c7" },
      { token: "function", foreground: "1f6fb2" },
      { token: "identifier", foreground: "242629" },
      { token: "variable", foreground: "242629" },
      { token: "variable.predefined", foreground: "1f6fb2" },
      { token: "delimiter", foreground: "242629" },
      { token: "operator", foreground: "242629" },
      { token: "tag", foreground: "1f6fb2" },
      { token: "attribute.name", foreground: "7c55c7" },
    ],
    colors: {
      "editor.background": "#f8f8f7",
      "editor.foreground": "#242629",
      "editorLineNumber.foreground": "#9a9da3",
      "editorLineNumber.activeForeground": "#70747a",
      "editorCursor.foreground": "#242629",
      "editor.selectionBackground": "#8ec7ff66",
      "editor.inactiveSelectionBackground": "#8ec7ff33",
      "editor.selectionHighlightBackground": "#00000000",
      "editor.wordHighlightBackground": "#00000000",
      "editor.wordHighlightStrongBackground": "#00000000",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#d8dadc",
      "editorIndentGuide.activeBackground1": "#c6c9cd",
      "editorOverviewRuler.border": "#00000000",
      "scrollbarSlider.background": "#0000001a",
      "scrollbarSlider.hoverBackground": "#00000026",
      "scrollbarSlider.activeBackground": "#00000033",
    },
    semanticHighlighting: false,
  });

  const compilerOptions = {
    allowJs: true,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    resolveJsonModule: true,
    skipLibCheck: true,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
  };

  for (const defaults of [
    monaco.languages.typescript.typescriptDefaults,
    monaco.languages.typescript.javascriptDefaults,
  ]) {
    defaults.setCompilerOptions(compilerOptions);
    defaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSuggestionDiagnostics: true,
      noSyntaxValidation: false,
    });
  }
};

export function MonacoFileEditor({
  filePath,
  contents,
  workspaceRoot,
  onClose,
}: MonacoFileEditorProps) {
  const { resolvedTheme } = useTheme();
  const writeFile = useProjectWriteFile();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialContentsRef = useRef(contents);

  const isDark = resolvedTheme === "dark";

  const handleEditorDidMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco as unknown as typeof import("monaco-editor");
    editorInstance.focus();
  }, []);

  const handleSave = useCallback(async () => {
    const instance = editorRef.current;
    if (!instance || saving) return;
    setSaving(true);
    try {
      const value = instance.getValue();
      await writeFile.mutateAsync({
        cwd: workspaceRoot,
        relativePath: filePath,
        contents: value,
      });
      initialContentsRef.current = value;
      setDirty(false);
    } catch {
      // Error toast or notification would go here
    } finally {
      setSaving(false);
    }
  }, [filePath, workspaceRoot, saving, writeFile]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    setDirty(value !== initialContentsRef.current);
  }, []);

  useEffect(() => {
    const instance = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!instance || !monacoInstance) return;

    const action = instance.addAction({
      id: "save-file",
      label: "Save File",
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
      run: () => {
        void handleSave();
      },
    });

    return () => {
      action.dispose();
    };
  }, [handleSave]);

  const monacoTheme = isDark ? "synara-editor-dark" : "synara-editor-light";
  const modelPath = normalizeMonacoModelPath(workspaceRoot, filePath);

  return (
    <div className="monaco-file-editor flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-background-surface)]">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/65 px-3">
        <FileEntryIcon pathValue={filePath} kind="file" className="size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-foreground">
            {basenameOfPath(filePath)}
          </div>
          <div className="truncate text-[10px] text-muted-foreground/75">{filePath}</div>
        </div>
        {dirty ? (
          <span className="size-2 shrink-0 rounded-full bg-yellow-500" title="Unsaved changes" />
        ) : null}
        <ChatHeaderIconButton
          type="button"
          label="Save"
          title={saving ? "Saving..." : "Save"}
          tone="plain"
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </ChatHeaderIconButton>
        <ChatHeaderIconButton
          type="button"
          label="Close editor"
          title="Close editor"
          tone="plain"
          onClick={onClose}
        >
          <XIcon className="size-3.5" />
        </ChatHeaderIconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          key={filePath}
          path={modelPath}
          defaultLanguage={languageFromPath(filePath)}
          defaultValue={contents}
          theme={monacoTheme}
          beforeMount={configureMonacoBeforeMount}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            lineHeight: 21,
            fontFamily: "var(--font-chat-code-family)",
            fontLigatures: true,
            lineNumbers: "on",
            lineNumbersMinChars: 5,
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 10,
            minimap: { enabled: false },
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            renderLineHighlight: "all",
            occurrencesHighlight: "singleFile",
            selectionHighlight: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: "none",
            bracketPairColorization: { enabled: false },
            guides: {
              bracketPairs: false,
              bracketPairsHorizontal: false,
              highlightActiveBracketPair: true,
              highlightActiveIndentation: true,
              indentation: true,
            },
            wordWrap: "off",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderFinalNewline: "off",
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              horizontalScrollbarSize: 8,
              verticalScrollbarSize: 8,
              verticalHasArrows: false,
              horizontalHasArrows: false,
            },
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>
    </div>
  );
}
