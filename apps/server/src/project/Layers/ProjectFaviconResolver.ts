import { Effect, FileSystem, Layer, Path } from "effect";

import {
  ProjectFaviconResolver,
  type ProjectFaviconResolverShape,
} from "../Services/ProjectFaviconResolver";

const FAVICON_CANDIDATES = [
  "favicon.ico",
  "favicon.svg",
  "favicon.png",
  "public/favicon.ico",
  "public/favicon.svg",
  "public/favicon.png",
  "public/vite.svg",
  "public/logo192.png",
  "public/logo512.png",
  "app/favicon.ico",
  "app/icon.svg",
  "app/icon.png",
  "app/favicon.png",
  "app/icon.ico",
  "static/favicon.ico",
  "static/favicon.png",
  "static/favicon.svg",
  "static/logo.svg",
  "static/logo.png",
  "src/favicon.ico",
  "src/favicon.svg",
  "src/app/favicon.ico",
  "src/app/icon.svg",
  "src/app/icon.png",
  "assets/icon.svg",
  "assets/icon.png",
  "assets/logo.svg",
  "assets/logo.png",
] as const;

const ICON_SOURCE_FILES = [
  "index.html",
  "public/index.html",
  "src/index.html",
  "app.html",
  "src/app.html",
  "app/root.tsx",
  "src/root.tsx",
  "app/routes/__root.tsx",
  "src/routes/__root.tsx",
  "src/app/root.tsx",
] as const;

const LINK_ICON_HTML_RE =
  /<link\b(?=[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon)["'])(?=[^>]*\bhref=["']([^"'?]+))[^>]*>/i;
const LINK_ICON_OBJ_RE =
  /(?=[^}]*\brel\s*:\s*["'](?:icon|shortcut icon|apple-touch-icon)["'])(?=[^}]*\bhref\s*:\s*["']([^"'?]+))[^}]*/i;
const OG_IMAGE_RE =
  /<meta\b(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']([^"'?]+))[^>]*>/i;
const MANIFEST_ICON_RE = /"icons"\s*:\s*\[([^\]]+)\]/s;

function extractIconHref(source: string): string | null {
  const htmlMatch = source.match(LINK_ICON_HTML_RE);
  if (htmlMatch?.[1]) return htmlMatch[1];
  const objMatch = source.match(LINK_ICON_OBJ_RE);
  if (objMatch?.[1]) return objMatch[1];
  return null;
}

function extractOgImage(source: string): string | null {
  const match = source.match(OG_IMAGE_RE);
  return match?.[1] ?? null;
}

function extractManifestIcons(source: string): string[] {
  const block = source.match(MANIFEST_ICON_RE);
  if (!block || !block[1]) return [];
  const hrefs: string[] = [];
  const itemRe = /"src"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(block[1])) !== null) {
    if (m[1]) hrefs.push(m[1]);
  }
  return hrefs;
}

export const makeProjectFaviconResolver = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const resolveIconHref = (projectCwd: string, href: string): string[] => {
    const clean = href.replace(/^\//, "");
    return [path.join(projectCwd, "public", clean), path.join(projectCwd, clean)];
  };

  const isPathWithinProject = (projectCwd: string, candidatePath: string): boolean => {
    const relative = path.relative(path.resolve(projectCwd), path.resolve(candidatePath));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  };

  const findExistingFile = Effect.fn(function* (
    projectCwd: string,
    candidates: ReadonlyArray<string>,
  ) {
    for (const candidate of candidates) {
      if (!isPathWithinProject(projectCwd, candidate)) {
        continue;
      }
      const stats = yield* fileSystem
        .stat(candidate)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (stats?.type === "File") {
        return candidate;
      }
    }
    return null;
  });

  const resolvePath: ProjectFaviconResolverShape["resolvePath"] = Effect.fn(function* (cwd) {
    for (const candidate of FAVICON_CANDIDATES) {
      const existing = yield* findExistingFile(cwd, [path.join(cwd, candidate)]);
      if (existing) {
        return existing;
      }
    }

    for (const sourceFile of ICON_SOURCE_FILES) {
      const sourcePath = path.join(cwd, sourceFile);
      const source = yield* fileSystem
        .readFileString(sourcePath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!source) {
        continue;
      }
      const href = extractIconHref(source);
      if (href) {
        const existing = yield* findExistingFile(cwd, resolveIconHref(cwd, href));
        if (existing) {
          return existing;
        }
      }
    }

    for (const sourceFile of ICON_SOURCE_FILES) {
      const sourcePath = path.join(cwd, sourceFile);
      const source = yield* fileSystem
        .readFileString(sourcePath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!source) {
        continue;
      }
      const ogImage = extractOgImage(source);
      if (ogImage) {
        const existing = yield* findExistingFile(cwd, resolveIconHref(cwd, ogImage));
        if (existing) {
          return existing;
        }
      }
    }

    const manifestPath = path.join(cwd, "manifest.json");
    const manifest = yield* fileSystem
      .readFileString(manifestPath)
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (manifest) {
      const iconHrefs = extractManifestIcons(manifest);
      for (const href of iconHrefs) {
        const existing = yield* findExistingFile(cwd, resolveIconHref(cwd, href));
        if (existing) {
          return existing;
        }
      }
    }

    return null;
  });

  return { resolvePath } satisfies ProjectFaviconResolverShape;
});

export const ProjectFaviconResolverLive = Layer.effect(
  ProjectFaviconResolver,
  makeProjectFaviconResolver,
);
