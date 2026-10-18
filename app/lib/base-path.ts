/**
 * The path the app is served under (`APP_BASE_PATH` at build time, e.g.
 * `/task-manager`; empty at the root). App paths are stored and routed without
 * it (`/pages/:id`); it's added where a URL leaves the router: hrefs written
 * into the DOM by hand and `fetch` calls.
 */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

/** An app path (`/pages/x`) as a URL on this server; other URLs unchanged. */
export function withBase(href: string): string {
  return href.startsWith("/") && !href.startsWith("//") ? BASE_PATH + href : href;
}

/** A pathname on this server as an app path, for the router and stored links. */
export function withoutBase(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === BASE_PATH) return "/";
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
}
