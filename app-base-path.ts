/**
 * `APP_BASE_PATH` (e.g. `/task-manager`), the path a reverse proxy serves the
 * app under, normalised to `/x` without a trailing slash; `/` at the root.
 * Read at build time: Vite and React Router compile it into the bundles.
 */
export function appBasePath(value = process.env.APP_BASE_PATH ?? ""): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9._~\/-]*$/.test(trimmed)) throw new Error(`APP_BASE_PATH must be a path like /task-manager, got "${value}"`);
  return `/${trimmed}`;
}
