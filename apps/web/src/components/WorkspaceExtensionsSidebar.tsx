import { useState, useEffect, useCallback } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { SearchInput } from "./ui/search-input";
import { PluginIcon, StarIcon, DownloadIcon, CheckIcon, Loader2Icon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";

interface OpenVsxExtension {
  name: string;
  namespace: string;
  version: string;
  displayName?: string;
  description?: string;
  downloadCount?: number;
  averageRating?: number;
  reviewCount?: number;
  files?: {
    icon?: string;
  };
}

export function WorkspaceExtensionsSidebar(props: { workspaceRoot: string | null }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, { wait: 300 });
  const [extensions, setExtensions] = useState<OpenVsxExtension[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [installed, setInstalled] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("synara.extensions.installed") || "[]");
    } catch {
      return [];
    }
  });

  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchExtensions = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = debouncedQuery.trim()
          ? `https://open-vsx.org/api/-/search?query=${encodeURIComponent(debouncedQuery.trim())}&size=20`
          : `https://open-vsx.org/api/-/search?sortBy=downloadCount&size=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch extensions");
        const data = await res.json();
        if (active) {
          setExtensions(data.extensions || []);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load extensions");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchExtensions();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (!props.workspaceRoot) return;
    const loadWorkspaceExtensions = async () => {
      try {
        const api = ensureNativeApi();
        const res = await api.projects.readFile({
          cwd: props.workspaceRoot!,
          relativePath: ".synara/extensions.json",
        });
        if (res && res.contents) {
          const list = JSON.parse(res.contents);
          if (Array.isArray(list)) {
            setInstalled(list);
            localStorage.setItem("synara.extensions.installed", JSON.stringify(list));
            window.dispatchEvent(new Event("synara.extensions.changed"));
          }
        }
      } catch (e) {
        // file might not exist or error reading, ignore
      }
    };
    loadWorkspaceExtensions();
  }, [props.workspaceRoot]);

  const saveWorkspaceExtensions = useCallback(
    async (list: string[]) => {
      if (!props.workspaceRoot) return;
      try {
        const api = ensureNativeApi();
        await api.projects.writeFile({
          cwd: props.workspaceRoot,
          relativePath: ".synara/extensions.json",
          contents: JSON.stringify(list, null, 2),
        });
      } catch (e) {
        console.error("Failed to save extensions to workspace config", e);
      }
    },
    [props.workspaceRoot],
  );

  const handleInstall = useCallback(
    (extId: string) => {
      setInstalling((prev) => ({ ...prev, [extId]: true }));
      setTimeout(() => {
        setInstalling((prev) => ({ ...prev, [extId]: false }));
        setInstalled((prev) => {
          const next = [...prev, extId];
          localStorage.setItem("synara.extensions.installed", JSON.stringify(next));
          window.dispatchEvent(new Event("synara.extensions.changed"));
          void saveWorkspaceExtensions(next);
          return next;
        });
      }, 1200); // Realistic mock installation time
    },
    [saveWorkspaceExtensions],
  );

  const handleUninstall = useCallback(
    (extId: string) => {
      setInstalled((prev) => {
        const next = prev.filter((id) => id !== extId);
        localStorage.setItem("synara.extensions.installed", JSON.stringify(next));
        window.dispatchEvent(new Event("synara.extensions.changed"));
        void saveWorkspaceExtensions(next);
        return next;
      });
    },
    [saveWorkspaceExtensions],
  );

  return (
    <aside className="flex min-h-[11rem] w-full shrink-0 flex-col border-b border-border/65 bg-[var(--color-background-surface)] lg:h-full lg:w-[var(--editor-sidebar-width,224px)] lg:border-b-0 lg:border-r">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/65 px-3">
        <PluginIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/86">
          Extension Marketplace
        </span>
      </div>
      <div className="shrink-0 border-b border-border/65 p-2">
        <SearchInput
          value={query}
          placeholder="Search extensions..."
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1.5 space-y-1.5 animate-in fade-in duration-200">
        {loading && extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-2">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground/50" />
            <span className="text-[11px] text-muted-foreground">Searching marketplace...</span>
          </div>
        ) : error ? (
          <div className="p-3 text-center text-[11px] text-destructive/80">{error}</div>
        ) : extensions.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-muted-foreground">
            No extensions found.
          </div>
        ) : (
          extensions.map((ext) => {
            const extId = `${ext.namespace}.${ext.name}`;
            const isInstalled = installed.includes(extId);
            const isInstalling = installing[extId];
            const isExpanded = expandedId === extId;

            return (
              <div
                key={extId}
                className={cn(
                  "group rounded-md border border-transparent p-2 text-left transition-all hover:bg-[var(--color-background-button-secondary-hover)] cursor-pointer",
                  isExpanded
                    ? "bg-[var(--color-background-button-secondary)] border-border/40"
                    : "bg-transparent",
                )}
                onClick={() => setExpandedId(isExpanded ? null : extId)}
              >
                <div className="flex gap-2">
                  <div className="size-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border/20">
                    {ext.files?.icon ? (
                      <img src={ext.files.icon} alt="" className="size-full object-cover" />
                    ) : (
                      <PluginIcon className="size-4 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-foreground leading-tight">
                      {ext.displayName || ext.name}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground/75 leading-normal">
                      {ext.namespace} v{ext.version}
                    </div>
                  </div>
                </div>

                <div className="mt-1 text-[11px] text-muted-foreground/90 line-clamp-2 leading-tight">
                  {ext.description}
                </div>

                {isExpanded && (
                  <div
                    className="mt-2.5 pt-2 border-t border-border/20 space-y-2 text-[11px] text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
                      <span className="flex items-center gap-0.5">
                        <DownloadIcon className="size-3" />
                        {ext.downloadCount?.toLocaleString()} installs
                      </span>
                      {ext.averageRating !== undefined && (
                        <span className="flex items-center gap-0.5 text-yellow-500/90">
                          <StarIcon className="size-3 fill-current" />
                          {ext.averageRating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      {isInstalled ? (
                        <>
                          <button
                            type="button"
                            className="flex-1 h-6 rounded bg-green-500/10 hover:bg-green-500/20 text-green-500 font-medium text-[11px] flex items-center justify-center gap-1 cursor-default"
                          >
                            <CheckIcon className="size-3" />
                            Installed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUninstall(extId)}
                            className="px-2 h-6 rounded border border-border/40 hover:bg-destructive/10 hover:text-destructive text-[11px] cursor-pointer"
                          >
                            Uninstall
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isInstalling}
                          onClick={() => handleInstall(extId)}
                          className={cn(
                            "flex-1 h-6 rounded font-semibold text-[11px] flex items-center justify-center gap-1",
                            isInstalling
                              ? "bg-muted text-muted-foreground cursor-wait"
                              : "bg-[var(--color-text-accent)] hover:opacity-90 text-white cursor-pointer",
                          )}
                        >
                          {isInstalling ? (
                            <>
                              <Loader2Icon className="size-3 animate-spin" />
                              Installing...
                            </>
                          ) : (
                            "Install"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
