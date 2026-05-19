/**
 * Resolve a static asset path against the configured asset base URL.
 *
 * When NEXT_PUBLIC_ASSETS_BASE_URL is set (production), the path is prefixed
 * with it. When unset (local dev), the path is returned unchanged so Next.js
 * can serve it from /public.
 *
 * Non-rooted paths (e.g. already-absolute URLs) are returned as-is.
 */
export function assetUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}
