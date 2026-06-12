// FILE: TydeLogo.tsx
// Purpose: Render the Tyde app icon. Supports "default" and "nightly" variants.
// Layer: Shared app branding primitive

import { useState, useEffect } from "react";
import { cn } from "~/lib/utils";

export type AppIconVariant = "default" | "nightly";

const ICON_SOURCES: Record<AppIconVariant, string> = {
  default: "/tyde-icon.png",
  nightly: "/tyde-icon-nightly.png",
};

const APP_SETTINGS_KEY = "synara:app-settings:v1";

function readIconVariant(): AppIconVariant {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.appIconVariant === "nightly") return "nightly";
    }
  } catch {
    // ignore
  }
  return "default";
}

interface TydeLogoProps {
  variant?: AppIconVariant | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
}

export function TydeLogo({ variant, className, "aria-label": ariaLabel }: TydeLogoProps) {
  const [resolvedVariant, setResolvedVariant] = useState<AppIconVariant>(
    variant ?? readIconVariant,
  );

  useEffect(() => {
    if (variant !== undefined) return;
    const update = () => setResolvedVariant(readIconVariant());
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [variant]);

  return (
    <img
      src={ICON_SOURCES[resolvedVariant]}
      alt={ariaLabel ?? "Tyde"}
      className={cn("shrink-0 rounded-[22%] object-contain", className)}
      draggable={false}
    />
  );
}
