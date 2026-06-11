// FILE: useProjectFavicon.ts
// Purpose: Shared hook to resolve project favicon URLs and probe availability.
// Layer: UI utility
// Exports: useProjectFavicon

import { useEffect, useState } from "react";

const presence = new Map<string, boolean>();

function resolveServerHttpOrigin(): string {
  if (typeof window === "undefined") return "";

  const bridgeWsUrl = (window as { desktopBridge?: { getWsUrl?: () => string } }).desktopBridge;
  const envWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const wsCandidate =
    typeof bridgeWsUrl?.getWsUrl === "function" && bridgeWsUrl.getWsUrl().length > 0
      ? bridgeWsUrl.getWsUrl()
      : typeof envWsUrl === "string" && envWsUrl.length > 0
        ? envWsUrl
        : null;

  if (!wsCandidate) return window.location.origin;

  try {
    const wsUrl = new URL(wsCandidate);
    const protocol =
      wsUrl.protocol === "wss:" ? "https:" : wsUrl.protocol === "ws:" ? "http:" : wsUrl.protocol;
    return `${protocol}//${wsUrl.host}`;
  } catch {
    return window.location.origin;
  }
}

export function resolveProjectFaviconUrl(cwd: string): string {
  const origin = resolveServerHttpOrigin();
  const url =
    origin.length > 0
      ? new URL("/api/project-favicon", origin)
      : new URL("/api/project-favicon", "http://localhost");
  url.searchParams.set("cwd", cwd);
  url.searchParams.set("fallback", "none");
  return origin.length > 0 ? url.toString() : `${url.pathname}${url.search}`;
}

export function useProjectFavicon(cwd: string | null | undefined): {
  src: string;
  available: boolean;
} {
  const src = cwd ? resolveProjectFaviconUrl(cwd) : "";
  const [available, setAvailable] = useState<boolean>(() =>
    src ? presence.get(src) === true : false,
  );

  useEffect(() => {
    if (!src) {
      setAvailable(false);
      return;
    }

    const cached = presence.get(src);
    if (cached !== undefined) {
      setAvailable(cached);
      return;
    }

    let cancelled = false;
    const image = new Image();

    const handleLoad = () => {
      presence.set(src, true);
      if (!cancelled) setAvailable(true);
    };
    const handleError = () => {
      presence.set(src, false);
      if (!cancelled) setAvailable(false);
    };

    image.addEventListener("load", handleLoad);
    image.addEventListener("error", handleError);
    image.src = src;

    return () => {
      cancelled = true;
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
  }, [src]);

  return { src, available };
}
