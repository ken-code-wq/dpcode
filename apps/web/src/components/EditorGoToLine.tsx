import { useCallback, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";

interface EditorGoToLineProps {
  editor: editor.IStandaloneCodeEditor | null;
  open: boolean;
  onClose: () => void;
}

function parseLine(raw: string): { line: number; column: number | null } | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const parts = trimmed.split(":");
  const line = Number.parseInt(parts[0]!, 10);
  if (!Number.isFinite(line) || line < 1) return null;

  let column: number | null = null;
  if (parts.length > 1 && parts[1]!.length > 0) {
    column = Number.parseInt(parts[1]!, 10);
    if (!Number.isFinite(column) || column < 1) column = null;
  }

  return { line, column };
}

export function EditorGoToLine({ editor: editorInstance, open, onClose }: EditorGoToLineProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  const totalLines = editorInstance?.getModel()?.getLineCount() ?? 0;

  // Reset and focus when opening
  useEffect(() => {
    if (open) {
      setValue("");
      // Defer focus to next frame so the input is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const close = useCallback(() => {
    onClose();
    // Re-focus the editor after closing
    editorInstance?.focus();
  }, [onClose, editorInstance]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const parsed = parseLine(value);
        if (!parsed || !editorInstance) {
          close();
          return;
        }

        const clampedLine = Math.min(Math.max(parsed.line, 1), totalLines || 1);
        const column = parsed.column ?? 1;

        editorInstance.setPosition({ lineNumber: clampedLine, column });
        editorInstance.revealLineInCenter(clampedLine);
        editorInstance.focus();
        onClose();
      }
    },
    [value, editorInstance, totalLines, close, onClose],
  );

  if (!open) return null;

  return (
    <div
      className={cn(
        "editor-go-to-line absolute top-0 left-1/2 z-50 w-[350px] max-w-[calc(100%-2rem)] -translate-x-1/2",
        "rounded-b-lg border border-t-0 shadow-lg",
        isDark
          ? "border-white/10 bg-[rgba(30,30,30,0.85)] text-[#d8d8d9]"
          : "border-black/10 bg-[rgba(255,255,255,0.92)] text-[#242629]",
      )}
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="p-2">
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "w-full rounded-md border px-3 py-1.5 text-[13px] outline-none",
            isDark
              ? "border-white/10 bg-white/5 text-[#d8d8d9] placeholder:text-[#6f7781]"
              : "border-black/10 bg-black/5 text-[#242629] placeholder:text-[#7a828c]",
          )}
          placeholder="Go to Line (:column)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={close}
          autoComplete="off"
          spellCheck={false}
        />
        <p className={cn("mt-1.5 px-1 text-[11px]", isDark ? "text-[#6f7781]" : "text-[#7a828c]")}>
          {totalLines > 0 ? `Type a line number between 1 and ${totalLines}` : "No file is open"}
        </p>
      </div>
    </div>
  );
}
