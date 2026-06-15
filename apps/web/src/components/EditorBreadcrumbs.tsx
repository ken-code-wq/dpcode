import { memo, useMemo, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { FileEntryIcon } from "./chat/FileEntryIcon";
import { FolderClosed } from "./FolderClosed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorBreadcrumbsProps {
  filePath: string;
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EditorBreadcrumbs = memo(function EditorBreadcrumbs({
  filePath,
  children,
}: EditorBreadcrumbsProps) {
  const segments = useMemo(() => {
    // Strip leading slash(es), then split on `/`.
    const cleaned = filePath.replace(/^\/+/u, "");
    return cleaned.split("/").filter(Boolean);
  }, [filePath]);

  if (segments.length === 0) return null;

  const lastIndex = segments.length - 1;

  return (
    <div
      className={cn(
        "editor-breadcrumbs",
        "flex min-h-8 shrink-0 items-center justify-between border-b border-border/30 py-4",
        "bg-[var(--color-background-surface)] px-3 text-[11px] text-muted-foreground",
      )}
      style={{
        fontFamily: "var(--font-chat-code-family, ui-monospace, monospace)",
      }}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {segments.map((segment, index) => {
          const isLast = index === lastIndex;

          return (
            <span key={index} className="flex shrink-0 items-center">
              {/* Chevron separator (skip before first segment) */}
              {index > 0 && (
                <span className="px-1 text-muted-foreground/50 select-none" aria-hidden="true">
                  ›
                </span>
              )}

              {isLast ? (
                /* ---- File segment (last) ---- */
                <span className="flex items-center gap-1 rounded px-1 py-0.5 text-foreground">
                  <FileEntryIcon pathValue={filePath} kind="file" className="!size-3 shrink-0" />
                  <span className="whitespace-nowrap">{segment}</span>
                </span>
              ) : (
                /* ---- Directory segment ---- */
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
                  title={segments.slice(0, index + 1).join("/")}
                >
                  <FolderClosed className="!size-3 shrink-0 text-muted-foreground" />
                  <span className="whitespace-nowrap">{segment}</span>
                </button>
              )}
            </span>
          );
        })}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 pl-2">{children}</div>}
    </div>
  );
});
