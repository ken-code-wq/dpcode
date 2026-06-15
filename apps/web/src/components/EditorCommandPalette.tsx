import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";

interface EditorCommandPaletteProps {
  editor: editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof import("monaco-editor") | null;
  open: boolean;
  onClose: () => void;
  onGoToLine: () => void;
  onQuickOpen: () => void;
}

interface EditorCommand {
  id: string;
  label: string;
  category: string;
  keybinding?: string;
  action?: string;
}

const EDITOR_COMMANDS: EditorCommand[] = [
  { id: "editor.action.formatDocument", label: "Format Document", category: "Format" },
  { id: "toggleMinimap", label: "Toggle Minimap", category: "View", action: "custom" },
  { id: "toggleWordWrap", label: "Toggle Word Wrap", category: "View", action: "custom" },
  {
    id: "toggleRenderWhitespace",
    label: "Toggle Render Whitespace",
    category: "View",
    action: "custom",
  },
  { id: "editor.foldAll", label: "Fold All", category: "Folding" },
  { id: "editor.unfoldAll", label: "Unfold All", category: "Folding" },
  {
    id: "editor.action.toggleTabFocusMode",
    label: "Toggle Tab Focus Mode",
    category: "Editor",
  },
  {
    id: "editor.action.commentLine",
    label: "Toggle Line Comment",
    category: "Editor",
    keybinding: "⌘/",
  },
  {
    id: "editor.action.blockComment",
    label: "Toggle Block Comment",
    category: "Editor",
    keybinding: "⌥⇧A",
  },
  {
    id: "editor.action.selectHighlights",
    label: "Select All Occurrences",
    category: "Selection",
    keybinding: "⌘⇧L",
  },
  {
    id: "editor.action.addSelectionToNextFindMatch",
    label: "Add Selection to Next Match",
    category: "Selection",
    keybinding: "⌘D",
  },
  {
    id: "editor.action.deleteLines",
    label: "Delete Line",
    category: "Editor",
    keybinding: "⌘⇧K",
  },
  {
    id: "editor.action.copyLinesDownAction",
    label: "Copy Line Down",
    category: "Editor",
    keybinding: "⌥⇧↓",
  },
  {
    id: "editor.action.copyLinesUpAction",
    label: "Copy Line Up",
    category: "Editor",
    keybinding: "⌥⇧↑",
  },
  {
    id: "editor.action.moveLinesDownAction",
    label: "Move Line Down",
    category: "Editor",
    keybinding: "⌥↓",
  },
  {
    id: "editor.action.moveLinesUpAction",
    label: "Move Line Up",
    category: "Editor",
    keybinding: "⌥↑",
  },
  {
    id: "editor.action.indentLines",
    label: "Indent Line",
    category: "Editor",
    keybinding: "⌘]",
  },
  {
    id: "editor.action.outdentLines",
    label: "Outdent Line",
    category: "Editor",
    keybinding: "⌘[",
  },
  {
    id: "editor.action.transformToUppercase",
    label: "Transform to Uppercase",
    category: "Transform",
  },
  {
    id: "editor.action.transformToLowercase",
    label: "Transform to Lowercase",
    category: "Transform",
  },
  {
    id: "editor.action.transformToTitlecase",
    label: "Transform to Title Case",
    category: "Transform",
  },
  {
    id: "editor.action.sortLinesAscending",
    label: "Sort Lines Ascending",
    category: "Editor",
  },
  {
    id: "editor.action.sortLinesDescending",
    label: "Sort Lines Descending",
    category: "Editor",
  },
  {
    id: "editor.action.trimTrailingWhitespace",
    label: "Trim Trailing Whitespace",
    category: "Editor",
  },
  {
    id: "editor.action.revealDefinition",
    label: "Go to Definition",
    category: "Navigation",
    keybinding: "F12",
  },
  {
    id: "editor.action.peekDefinition",
    label: "Peek Definition",
    category: "Navigation",
    keybinding: "⌥F12",
  },
  {
    id: "editor.action.goToReferences",
    label: "Go to References",
    category: "Navigation",
    keybinding: "⇧F12",
  },
  {
    id: "editor.action.rename",
    label: "Rename Symbol",
    category: "Refactor",
    keybinding: "F2",
  },
  {
    id: "goToLine",
    label: "Go to Line...",
    category: "Navigation",
    keybinding: "⌃G",
    action: "goToLine",
  },
  {
    id: "quickOpen",
    label: "Go to File...",
    category: "Navigation",
    keybinding: "⌘P",
    action: "quickOpen",
  },
  {
    id: "editor.action.quickCommand",
    label: "Command Palette",
    category: "View",
    keybinding: "⌘⇧P",
  },
  {
    id: "editor.action.findReferences",
    label: "Find All References",
    category: "Navigation",
  },
  { id: "cursorUndo", label: "Cursor Undo", category: "Cursor", keybinding: "⌘U" },
  {
    id: "editor.action.insertCursorAbove",
    label: "Add Cursor Above",
    category: "Cursor",
    keybinding: "⌥⌘↑",
  },
  {
    id: "editor.action.insertCursorBelow",
    label: "Add Cursor Below",
    category: "Cursor",
    keybinding: "⌥⌘↓",
  },
  {
    id: "editor.action.toggleStickyScroll",
    label: "Toggle Sticky Scroll",
    category: "View",
    action: "custom",
  },
  {
    id: "editor.action.toggleBracketPairColorization",
    label: "Toggle Bracket Colorization",
    category: "View",
    action: "custom",
  },
];

/** Simple fuzzy match: every character in the query appears in order in the target. */
function fuzzyMatch(query: string, target: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
    if (lowerTarget[ti] === lowerQuery[qi]) {
      qi++;
    }
  }
  return qi === lowerQuery.length;
}

// Tracks runtime toggle state for custom view options.
// Stored outside the component so it persists across open/close cycles within
// the same page session, matching VS Code's toggle behavior.
const toggleState: Record<string, boolean> = {};

function executeCustomToggle(editorInstance: editor.IStandaloneCodeEditor, commandId: string) {
  switch (commandId) {
    case "toggleMinimap": {
      const current = toggleState["minimap"] ?? false;
      toggleState["minimap"] = !current;
      editorInstance.updateOptions({ minimap: { enabled: !current } });
      break;
    }
    case "toggleWordWrap": {
      const current = toggleState["wordWrap"] ?? false;
      toggleState["wordWrap"] = !current;
      editorInstance.updateOptions({ wordWrap: !current ? "on" : "off" });
      break;
    }
    case "toggleRenderWhitespace": {
      const current = toggleState["renderWhitespace"] ?? false;
      toggleState["renderWhitespace"] = !current;
      editorInstance.updateOptions({ renderWhitespace: !current ? "all" : "none" });
      break;
    }
    case "editor.action.toggleStickyScroll": {
      const current = toggleState["stickyScroll"] ?? false;
      toggleState["stickyScroll"] = !current;
      editorInstance.updateOptions({ stickyScroll: { enabled: !current } });
      break;
    }
    case "editor.action.toggleBracketPairColorization": {
      const current = toggleState["bracketPairColorization"] ?? false;
      toggleState["bracketPairColorization"] = !current;
      editorInstance.updateOptions({ bracketPairColorization: { enabled: !current } });
      break;
    }
  }
}

export function EditorCommandPalette({
  editor: editorInstance,
  open,
  onClose,
  onGoToLine,
  onQuickOpen,
}: EditorCommandPaletteProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Strip leading ">" for the search query
  const searchQuery = query.startsWith(">") ? query.slice(1).trim() : query.trim();

  const filteredCommands = useMemo(() => {
    if (searchQuery.length === 0) return EDITOR_COMMANDS;
    return EDITOR_COMMANDS.filter(
      (cmd) => fuzzyMatch(searchQuery, cmd.label) || fuzzyMatch(searchQuery, cmd.category),
    );
  }, [searchQuery]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery(">");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        // Place cursor after the ">" prefix
        inputRef.current?.setSelectionRange(1, 1);
      });
    }
  }, [open]);

  // Clamp selected index when list changes
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(filteredCommands.length - 1, 0)));
  }, [filteredCommands.length]);

  // Scroll the active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeItem = list.children[selectedIndex] as HTMLElement | undefined;
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: EditorCommand) => {
      onClose();

      if (cmd.action === "goToLine") {
        onGoToLine();
        return;
      }

      if (cmd.action === "quickOpen") {
        onQuickOpen();
        return;
      }

      if (!editorInstance) return;

      if (cmd.action === "custom") {
        executeCustomToggle(editorInstance, cmd.id);
        editorInstance.focus();
        return;
      }

      editorInstance.trigger("commandPalette", cmd.id, null);
      editorInstance.focus();
    },
    [editorInstance, onClose, onGoToLine, onQuickOpen],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        editorInstance?.focus();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          executeCommand(cmd);
        }
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onClose, editorInstance],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = e.target.value;
      setQuery(nextValue);
      setSelectedIndex(0);

      // If query doesn't start with ">", switch to quick-open mode
      if (!nextValue.startsWith(">")) {
        onClose();
        onQuickOpen();
      }
    },
    [onClose, onQuickOpen],
  );

  if (!open) return null;

  return (
    <div
      className={cn(
        "editor-command-palette absolute top-0 left-1/2 z-50 flex w-[500px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col",
        "rounded-b-lg border border-t-0 shadow-lg",
        isDark
          ? "border-white/10 bg-[rgba(30,30,30,0.85)] text-[#d8d8d9]"
          : "border-black/10 bg-[rgba(255,255,255,0.92)] text-[#242629]",
      )}
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="shrink-0 p-2 pb-0">
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "w-full rounded-md border px-3 py-1.5 text-[13px] outline-none",
            isDark
              ? "border-white/10 bg-white/5 text-[#d8d8d9] placeholder:text-[#6f7781]"
              : "border-black/10 bg-black/5 text-[#242629] placeholder:text-[#7a828c]",
          )}
          placeholder="Type a command..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div ref={listRef} className="max-h-[320px] min-h-0 overflow-y-auto py-1" role="listbox">
        {filteredCommands.length === 0 ? (
          <div
            className={cn(
              "px-3 py-4 text-center text-[12px]",
              isDark ? "text-[#6f7781]" : "text-[#7a828c]",
            )}
          >
            No matching commands
          </div>
        ) : (
          filteredCommands.map((cmd, index) => (
            <button
              key={cmd.id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px]",
                index === selectedIndex
                  ? isDark
                    ? "bg-white/10"
                    : "bg-black/8"
                  : isDark
                    ? "hover:bg-white/5"
                    : "hover:bg-black/4",
              )}
              onPointerEnter={() => setSelectedIndex(index)}
              onPointerDown={(e) => {
                // Prevent blur on the input
                e.preventDefault();
              }}
              onClick={() => executeCommand(cmd)}
            >
              <span
                className={cn("shrink-0 text-[11px]", isDark ? "text-[#6f7781]" : "text-[#7a828c]")}
              >
                {cmd.category}:
              </span>
              <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
              {cmd.keybinding ? (
                <kbd
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none",
                    isDark ? "bg-white/8 text-[#6f7781]" : "bg-black/6 text-[#7a828c]",
                  )}
                >
                  {cmd.keybinding}
                </kbd>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
