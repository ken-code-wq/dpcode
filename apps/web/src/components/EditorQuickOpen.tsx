import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";
import { projectSearchEntriesQueryOptions } from "~/lib/projectReactQuery";
import { basenameOfPath } from "~/file-icons";
import { FileEntryIcon } from "./chat/FileEntryIcon";

interface EditorQuickOpenProps {
  open: boolean;
  onClose: () => void;
  workspaceRoot: string | null;
  onSelectFile: (path: string) => void;
  onSwitchToCommandPalette: () => void;
  onSwitchToGoToLine: () => void;
}

/** Split a file path into a basename and its parent directory. */
function splitPath(path: string): { basename: string; dir: string } {
  const basename = basenameOfPath(path);
  const lastSep = path.lastIndexOf("/");
  const dir = lastSep > 0 ? path.slice(0, lastSep) : "";
  return { basename, dir };
}

export function EditorQuickOpen({
  open,
  onClose,
  workspaceRoot,
  onSelectFile,
  onSwitchToCommandPalette,
  onSwitchToGoToLine,
}: EditorQuickOpenProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const trimmedQuery = query.trim();

  const [debouncedQuery] = useDebouncedValue(trimmedQuery, { wait: 150 });

  const entriesQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: workspaceRoot,
      query: debouncedQuery,
      kind: "file",
      limit: 20,
    }),
  );

  // Only show results when the debounced query has caught up
  const searchIsCurrent = trimmedQuery === debouncedQuery && !entriesQuery.isPlaceholderData;
  const entries = useMemo(
    () => (searchIsCurrent ? (entriesQuery.data?.entries ?? []) : []),
    [searchIsCurrent, entriesQuery.data?.entries],
  );

  // Reset when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(entries.length - 1, 0)));
  }, [entries.length]);

  // Scroll the active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeItem = list.children[selectedIndex] as HTMLElement | undefined;
    activeItem?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const entry = entries[selectedIndex];
        if (entry) {
          close();
          onSelectFile(entry.path);
        }
      }
    },
    [entries, selectedIndex, close, onSelectFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = e.target.value;

      // Switch to command palette if query starts with ">"
      if (nextValue.startsWith(">")) {
        close();
        onSwitchToCommandPalette();
        return;
      }

      // Switch to go-to-line if query starts with ":"
      if (nextValue.startsWith(":")) {
        close();
        onSwitchToGoToLine();
        return;
      }

      setQuery(nextValue);
      setSelectedIndex(0);
    },
    [close, onSwitchToCommandPalette, onSwitchToGoToLine],
  );

  if (!open) return null;

  const showNoResults = searchIsCurrent && trimmedQuery.length > 0 && entries.length === 0;
  const showPlaceholder = trimmedQuery.length === 0;
  const showLoading = trimmedQuery.length > 0 && !searchIsCurrent && entries.length === 0;

  return (
    <div
      className={cn(
        "editor-quick-open absolute top-0 left-1/2 z-50 flex w-[500px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col",
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
          placeholder="Search files by name..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div ref={listRef} className="max-h-[320px] min-h-0 overflow-y-auto py-1" role="listbox">
        {showPlaceholder ? (
          <div
            className={cn(
              "px-3 py-4 text-center text-[12px]",
              isDark ? "text-[#6f7781]" : "text-[#7a828c]",
            )}
          >
            Type to search files...
          </div>
        ) : showLoading ? (
          <div
            className={cn(
              "px-3 py-4 text-center text-[12px]",
              isDark ? "text-[#6f7781]" : "text-[#7a828c]",
            )}
          >
            Searching...
          </div>
        ) : showNoResults ? (
          <div
            className={cn(
              "px-3 py-4 text-center text-[12px]",
              isDark ? "text-[#6f7781]" : "text-[#7a828c]",
            )}
          >
            No files found
          </div>
        ) : (
          entries.map((entry, index) => {
            const { basename, dir } = splitPath(entry.path);
            return (
              <button
                key={entry.path}
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
                onClick={() => {
                  close();
                  onSelectFile(entry.path);
                }}
              >
                <FileEntryIcon pathValue={entry.path} kind="file" className="size-3.5 shrink-0" />
                <span className="shrink-0 truncate font-medium">{basename}</span>
                {dir ? (
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[11px]",
                      isDark ? "text-[#6f7781]" : "text-[#7a828c]",
                    )}
                  >
                    {dir}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
