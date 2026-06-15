import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "~/hooks/useTheme";
import { useProjectWriteFile } from "~/lib/projectReactQuery";
import { basenameOfPath } from "~/file-icons";
import { FileEntryIcon } from "./chat/FileEntryIcon";
import { ChatHeaderIconButton } from "./chat/chatHeaderControls";
import { XIcon, EyeIcon } from "~/lib/icons";
import { ensureNativeApi } from "~/nativeApi";
import { OpenInPicker } from "./chat/OpenInPicker";
import { joinWorkspaceRelativePath } from "@t3tools/shared/path";

import { EditorStatusBar } from "./EditorStatusBar";
import { EditorBreadcrumbs } from "./EditorBreadcrumbs";
import { EditorCommandPalette } from "./EditorCommandPalette";
import { EditorQuickOpen } from "./EditorQuickOpen";
import { EditorGoToLine } from "./EditorGoToLine";

interface MonacoFileEditorProps {
  filePath: string;
  contents: string;
  workspaceRoot: string;
  onClose: () => void;
  onSelectFile?: ((path: string) => void) | undefined;
  initialLine?: number | undefined;
  compact?: boolean;
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

let activeOpenHandler: ((path: string) => void) | null = null;
let activeWorkspaceRoot: string | null = null;
let activeCurrentFilePath: string | null = null;

const configureMonacoBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.registerCommand("synara.openRelativeFile", async (_: any, pathArg: string) => {
    const openHandler = activeOpenHandler;
    const workspaceRoot = activeWorkspaceRoot;
    const currentFilePath = activeCurrentFilePath;
    if (!openHandler || !workspaceRoot || !currentFilePath) {
      return;
    }

    const currentDir = currentFilePath.includes("/")
      ? currentFilePath.slice(0, currentFilePath.lastIndexOf("/"))
      : "";
    const parts = (currentDir + "/" + pathArg).split("/");
    const resolvedParts: string[] = [];
    for (const part of parts) {
      if (part === "." || part === "") continue;
      if (part === "..") {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    }
    const resolvedPath = resolvedParts.join("/");

    try {
      const api = ensureNativeApi();
      const searchResult = await api.projects.searchEntries({
        cwd: workspaceRoot,
        query: resolvedPath,
        limit: 10,
        kind: "file",
      });

      const match = searchResult.entries.find((entry) => {
        const entryPath = entry.path.replace(/\.[^/.]+$/, "");
        return entry.path === resolvedPath || entryPath === resolvedPath;
      });

      const firstEntry = searchResult.entries[0];
      if (match) {
        openHandler(match.path);
      } else if (firstEntry) {
        openHandler(firstEntry.path);
      }
    } catch (error) {
      console.error("Failed to open relative file link:", error);
    }
  });

  monaco.languages.registerLinkProvider(["javascript", "typescript", "css", "json", "html"], {
    provideLinks(model: editor.ITextModel) {
      const text = model.getValue();
      const links: { range: any; url: string }[] = [];
      const regex = /(?:['"`])(\.\.?\/[^\s'"`]+)(?:['"`])/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const startOffset = match.index + 1;
        const pathArg = match[1]!;
        const endOffset = startOffset + pathArg.length;
        const startPos = model.getPositionAt(startOffset);
        const endPos = model.getPositionAt(endOffset);

        const range = new monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column,
        );

        links.push({
          range,
          url: `command:synara.openRelativeFile?${encodeURIComponent(JSON.stringify(pathArg))}`,
        });
      }
      return { links };
    },
  });

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

  monaco.editor.defineTheme("dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" },
      { token: "regexp", foreground: "f1fa8c" },
      { token: "type", foreground: "8be9fd" },
      { token: "class", foreground: "8be9fd" },
      { token: "interface", foreground: "8be9fd" },
      { token: "function", foreground: "50fa7b" },
      { token: "variable", foreground: "f8f8f2" },
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editorLineNumber.foreground": "#6272a4",
      "editorLineNumber.activeForeground": "#ff79c6",
      "editor.selectionBackground": "#44475a",
      "editor.lineHighlightBackground": "#343746",
    },
  });

  monaco.editor.defineTheme("one-dark-pro", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c6370", fontStyle: "italic" },
      { token: "keyword", foreground: "c678dd" },
      { token: "string", foreground: "98c379" },
      { token: "number", foreground: "d19a66" },
      { token: "regexp", foreground: "98c379" },
      { token: "type", foreground: "e5c07b" },
      { token: "class", foreground: "e5c07b" },
      { token: "interface", foreground: "e5c07b" },
      { token: "function", foreground: "61afef" },
      { token: "variable", foreground: "e06c75" },
    ],
    colors: {
      "editor.background": "#282c34",
      "editor.foreground": "#abb2bf",
      "editorLineNumber.foreground": "#4b5263",
      "editorLineNumber.activeForeground": "#c8ccd4",
      "editor.selectionBackground": "#3e4451",
      "editor.lineHighlightBackground": "#2c313c",
    },
  });

  monaco.editor.defineTheme("gruvbox", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "928374", fontStyle: "italic" },
      { token: "keyword", foreground: "fb4934" },
      { token: "string", foreground: "b8bb26" },
      { token: "number", foreground: "d3869b" },
      { token: "regexp", foreground: "b8bb26" },
      { token: "type", foreground: "fabd2f" },
      { token: "class", foreground: "fabd2f" },
      { token: "interface", foreground: "fabd2f" },
      { token: "function", foreground: "8ec07c" },
      { token: "variable", foreground: "ebdbb2" },
    ],
    colors: {
      "editor.background": "#282828",
      "editor.foreground": "#ebdbb2",
      "editorLineNumber.foreground": "#7c6f64",
      "editorLineNumber.activeForeground": "#fabd2f",
      "editor.selectionBackground": "#504945",
      "editor.lineHighlightBackground": "#3c3836",
    },
  });

  monaco.editor.defineTheme("catppuccin", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6c7086", fontStyle: "italic" },
      { token: "keyword", foreground: "cba6f7" },
      { token: "string", foreground: "a6e3a1" },
      { token: "number", foreground: "fab387" },
      { token: "regexp", foreground: "a6e3a1" },
      { token: "type", foreground: "f9e2af" },
      { token: "class", foreground: "f9e2af" },
      { token: "interface", foreground: "f9e2af" },
      { token: "function", foreground: "89b4fa" },
      { token: "variable", foreground: "cdd6f4" },
    ],
    colors: {
      "editor.background": "#1e1e2e",
      "editor.foreground": "#cdd6f4",
      "editorLineNumber.foreground": "#585b70",
      "editorLineNumber.activeForeground": "#cba6f7",
      "editor.selectionBackground": "#313244",
      "editor.lineHighlightBackground": "#2e303f",
    },
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
      noSemanticValidation: false,
      noSuggestionDiagnostics: false,
      noSyntaxValidation: false,
    });
  }
};

let vimScriptPromise: Promise<void> | null = null;

function loadMonacoVimScript(): Promise<void> {
  if ((window as any).MonacoVim) {
    return Promise.resolve();
  }
  if (vimScriptPromise) {
    return vimScriptPromise;
  }
  vimScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/monaco-vim/dist/monaco-vim.js";
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = (err) => {
      vimScriptPromise = null;
      reject(err);
    };
    document.body.appendChild(script);
  });
  return vimScriptPromise;
}

export function MonacoFileEditor({
  filePath,
  contents,
  workspaceRoot,
  onClose,
  onSelectFile,
  initialLine,
  compact = false,
}: MonacoFileEditorProps) {
  const { resolvedTheme } = useTheme();
  const writeFile = useProjectWriteFile();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [installedExtensions, setInstalledExtensions] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("synara.extensions.installed") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleChanged = () => {
      try {
        setInstalledExtensions(
          JSON.parse(localStorage.getItem("synara.extensions.installed") || "[]"),
        );
      } catch {}
    };
    window.addEventListener("synara.extensions.changed", handleChanged);
    window.addEventListener("storage", handleChanged);
    return () => {
      window.removeEventListener("synara.extensions.changed", handleChanged);
      window.removeEventListener("storage", handleChanged);
    };
  }, []);

  const vimModeRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    const normalizedExtensions = installedExtensions.map((e) => e.toLowerCase());
    const hasVimExtension = normalizedExtensions.includes("vscodevim.vim");

    if (!editorInstance) return;

    if (hasVimExtension) {
      let active = true;
      loadMonacoVimScript()
        .then(() => {
          if (!active) return;
          if (vimModeRef.current) {
            vimModeRef.current.dispose();
            vimModeRef.current = null;
          }
          const statusNode = document.getElementById("synara-vim-status");
          if ((window as any).MonacoVim) {
            vimModeRef.current = (window as any).MonacoVim.initVimMode(editorInstance, statusNode);
          }
        })
        .catch((err) => {
          console.error("Failed to load monaco-vim script", err);
        });

      return () => {
        active = false;
        if (vimModeRef.current) {
          vimModeRef.current.dispose();
          vimModeRef.current = null;
        }
        const statusNode = document.getElementById("synara-vim-status");
        if (statusNode) {
          statusNode.textContent = "";
        }
      };
    } else {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
      const statusNode = document.getElementById("synara-vim-status");
      if (statusNode) {
        statusNode.textContent = "";
      }
    }
  }, [installedExtensions, editorInstance]);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialContentsRef = useRef(contents);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);

  const isDark = resolvedTheme === "dark";

  const handleEditorDidMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;
      setEditorInstance(editorInstance);
      monacoRef.current = monaco as unknown as typeof import("monaco-editor");
      editorInstance.focus();
      if (initialLine && initialLine > 0) {
        editorInstance.revealLineInCenter(initialLine);
        editorInstance.setPosition({ lineNumber: initialLine, column: 1 });
      }
    },
    [initialLine],
  );

  useEffect(() => {
    const instance = editorRef.current;
    if (instance && initialLine && initialLine > 0) {
      instance.revealLineInCenter(initialLine);
      instance.setPosition({ lineNumber: initialLine, column: 1 });
      instance.focus();
    }
  }, [initialLine]);

  useEffect(() => {
    activeOpenHandler = onSelectFile ?? null;
    activeWorkspaceRoot = workspaceRoot;
    activeCurrentFilePath = filePath;
    return () => {
      if (activeCurrentFilePath === filePath) {
        activeOpenHandler = null;
        activeWorkspaceRoot = null;
        activeCurrentFilePath = null;
      }
    };
  }, [filePath, workspaceRoot, onSelectFile]);

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

    const disposables: { dispose(): void }[] = [];

    // Save File
    const saveAction = instance.addAction({
      id: "save-file",
      label: "Save File",
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
      run: () => {
        void handleSave();
      },
    });
    disposables.push(saveAction);

    // Command Palette (F1 / Cmd+Shift+P)
    const cmdPaletteAction1 = instance.addAction({
      id: "synara.commandPalette1",
      label: "Command Palette...",
      keybindings: [
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyP,
      ],
      run: () => {
        setCommandPaletteOpen(true);
      },
    });
    disposables.push(cmdPaletteAction1);

    const cmdPaletteAction2 = instance.addAction({
      id: "synara.commandPalette2",
      label: "Command Palette...",
      keybindings: [monacoInstance.KeyCode.F1],
      run: () => {
        setCommandPaletteOpen(true);
      },
    });
    disposables.push(cmdPaletteAction2);

    // Quick Open (Cmd+P)
    const quickOpenAction = instance.addAction({
      id: "synara.quickOpen",
      label: "Go to File...",
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP],
      run: () => {
        setQuickOpenOpen(true);
      },
    });
    disposables.push(quickOpenAction);

    // Go to Line (Ctrl+G / WinCtrl+G / Cmd+G)
    const goToLineAction = instance.addAction({
      id: "synara.goToLine",
      label: "Go to Line...",
      keybindings: [
        monacoInstance.KeyMod.WinCtrl | monacoInstance.KeyCode.KeyG,
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyG,
      ],
      run: () => {
        setGoToLineOpen(true);
      },
    });
    disposables.push(goToLineAction);

    // Standard VS Code shortcuts mapping
    const vscodeKeybindings = [
      {
        key: monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Slash,
        cmd: "editor.action.commentLine",
      },
      {
        key: monacoInstance.KeyMod.Alt | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyA,
        cmd: "editor.action.blockComment",
      },
      {
        key: monacoInstance.KeyMod.Alt | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF,
        cmd: "editor.action.formatDocument",
      },
      {
        key: monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.UpArrow,
        cmd: "editor.action.moveLinesUpAction",
      },
      {
        key: monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.DownArrow,
        cmd: "editor.action.moveLinesDownAction",
      },
      {
        key:
          monacoInstance.KeyMod.Alt | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.UpArrow,
        cmd: "editor.action.copyLinesUpAction",
      },
      {
        key:
          monacoInstance.KeyMod.Alt |
          monacoInstance.KeyMod.Shift |
          monacoInstance.KeyCode.DownArrow,
        cmd: "editor.action.copyLinesDownAction",
      },
      {
        key:
          monacoInstance.KeyMod.CtrlCmd |
          monacoInstance.KeyMod.Alt |
          monacoInstance.KeyCode.UpArrow,
        cmd: "editor.action.insertCursorAbove",
      },
      {
        key:
          monacoInstance.KeyMod.CtrlCmd |
          monacoInstance.KeyMod.Alt |
          monacoInstance.KeyCode.DownArrow,
        cmd: "editor.action.insertCursorBelow",
      },
      {
        key:
          monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyK,
        cmd: "editor.action.deleteLines",
      },
      {
        key:
          monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyL,
        cmd: "editor.action.selectHighlights",
      },
      {
        key: monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyD,
        cmd: "editor.action.addSelectionToNextFindMatch",
      },
      {
        key: monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.BracketRight,
        cmd: "editor.action.indentLines",
      },
      {
        key: monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.BracketLeft,
        cmd: "editor.action.outdentLines",
      },
    ];

    for (const binding of vscodeKeybindings) {
      instance.addCommand(binding.key, () => {
        instance.trigger("keyboard", binding.cmd, null);
      });
    }

    return () => {
      for (const d of disposables) d.dispose();
    };
  }, [handleSave]);

  const monacoTheme = (() => {
    const normalized = installedExtensions.map((e) => e.toLowerCase());
    if (normalized.includes("dracula-theme.theme-dracula")) {
      return "dracula";
    }
    if (normalized.includes("zhuangtongfa.material-theme")) {
      return "one-dark-pro";
    }
    if (normalized.includes("jdinhlife.gruvbox")) {
      return "gruvbox";
    }
    if (normalized.includes("catppuccin.catppuccin-vsc")) {
      return "catppuccin";
    }
    return isDark ? "synara-editor-dark" : "synara-editor-light";
  })();
  const modelPath = normalizeMonacoModelPath(workspaceRoot, filePath);

  const isMarkdown =
    filePath.endsWith(".md") || filePath.endsWith(".markdown") || filePath.endsWith(".mdx");

  return (
    <div className="monaco-file-editor flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-background-surface)] ">
      {!compact ? (
        <>
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/65 px-3">
            <FileEntryIcon pathValue={filePath} kind="file" className="size-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-foreground">
                {basenameOfPath(filePath)}
              </div>
              <div className="truncate text-[10px] text-muted-foreground/75">{filePath}</div>
            </div>
            {dirty ? (
              <span
                className="size-2 shrink-0 rounded-full bg-yellow-500"
                title="Unsaved changes"
              />
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

          <EditorBreadcrumbs filePath={filePath} />
        </>
      ) : (
        <EditorBreadcrumbs filePath={filePath}>
          <div className="flex items-center gap-1">
            {dirty && (
              <ChatHeaderIconButton
                type="button"
                label="Save"
                title={saving ? "Saving..." : "Save"}
                tone="plain"
                disabled={saving}
                onClick={handleSave}
                className="size-6 p-0 hover:bg-foreground/[0.06] rounded flex items-center justify-center relative"
              >
                <span className="absolute top-0 right-0 size-1 rounded-full bg-yellow-500" />
                <svg
                  className="size-3.5 text-yellow-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </ChatHeaderIconButton>
            )}
            {isMarkdown && (
              <ChatHeaderIconButton
                type="button"
                label="Preview"
                title="Show preview"
                tone="plain"
                onClick={onClose}
                className="size-6 p-0 hover:bg-foreground/[0.06] rounded flex items-center justify-center"
              >
                <EyeIcon className="size-3.5" />
              </ChatHeaderIconButton>
            )}
            <OpenInPicker
              openInTarget={joinWorkspaceRelativePath(workspaceRoot, filePath)}
              labelMode="always"
            />
          </div>
        </EditorBreadcrumbs>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
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
            minimap: { enabled: true },
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
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              bracketPairsHorizontal: true,
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
            stickyScroll: { enabled: true },
            linkedEditing: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            parameterHints: { enabled: true },
            formatOnType: true,
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: "on",
          }}
        />

        <EditorCommandPalette
          editor={editorRef.current}
          monacoInstance={monacoRef.current}
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onGoToLine={() => {
            setCommandPaletteOpen(false);
            setGoToLineOpen(true);
          }}
          onQuickOpen={() => {
            setCommandPaletteOpen(false);
            setQuickOpenOpen(true);
          }}
        />

        <EditorQuickOpen
          open={quickOpenOpen}
          onClose={() => setQuickOpenOpen(false)}
          workspaceRoot={workspaceRoot}
          onSelectFile={(path) => {
            setQuickOpenOpen(false);
            onSelectFile?.(path);
          }}
          onSwitchToCommandPalette={() => {
            setQuickOpenOpen(false);
            setCommandPaletteOpen(true);
          }}
          onSwitchToGoToLine={() => {
            setQuickOpenOpen(false);
            setGoToLineOpen(true);
          }}
        />

        <EditorGoToLine
          editor={editorRef.current}
          open={goToLineOpen}
          onClose={() => setGoToLineOpen(false)}
        />
      </div>

      <EditorStatusBar
        editor={editorRef.current}
        language={languageFromPath(filePath)}
        filePath={filePath}
      />
    </div>
  );
}
