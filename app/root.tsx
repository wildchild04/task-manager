import type { ThemeMode } from "@wildchild/design-system";
import { useState } from "react";
import {
  createContext,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ErrorPage } from "./components/error-page";
import { gate, type SignedIn } from "./lib/auth.server";
import { useHydrated } from "./lib/use-hydrated";
import { services } from "./lib/services.server";
import { AppThemeProvider, readThemeCookie } from "./theme-mode";

/** The favicon, under the base path (`/task-manager/favicon.svg`) so it's served behind the proxy too. */
export const links: Route.LinksFunction = () => [{ rel: "icon", type: "image/svg+xml", href: `${import.meta.env.BASE_URL}favicon.svg` }];

/** Who is signed in, for the loaders that show it (the shell's account menu). */
export const signedInContext = createContext<SignedIn | null>(null);

/**
 * Everything needs signing in, except the sign-in screens and the agent API
 * (which has its own tokens); see `gate`. A renewed session's cookie is sent
 * back with whatever the route answers.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const decision = gate(services, request);
    if (!decision.pass) {
      if ("redirect" in decision) throw redirect(decision.redirect);
      return decision.response;
    }
    context.set(signedInContext, decision.signedIn ?? null);
    const response = await next();
    if (decision.setCookie) response.headers.append("Set-Cookie", decision.setCookie);
    return response;
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { themeMode: readThemeCookie(request.headers.get("cookie")) ?? ("light" as ThemeMode) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <AppThemeProvider initialMode={loaderData.themeMode}>
      <Outlet />
    </AppThemeProvider>
  );
}

/**
 * The theme for an error page: the root loader's when it ran (it does when a page's loader fails).
 * When it didn't (a failed action), the server can't know the mode, so it renders light and the browser
 * switches to the cookie's mode once hydrated, rendering the same as the server until then.
 */
function useErrorThemeMode(): ThemeMode {
  const data = useRouteLoaderData<typeof loader>("root");
  // Read before any effect runs, in the browser only.
  const [cookieMode] = useState(() => (typeof document === "undefined" ? null : readThemeCookie(document.cookie)));
  const hydrated = useHydrated();
  return data?.themeMode ?? (hydrated ? cookieMode : null) ?? "light";
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const mode = useErrorThemeMode();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <AppThemeProvider key={mode} initialMode={mode} persist={false}>
        <ErrorPage title="Not found" message="This page does not exist." />
      </AppThemeProvider>
    );
  }
  const details = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;
  return (
    <AppThemeProvider key={mode} initialMode={mode} persist={false}>
      <ErrorPage title="Something went wrong" message="An unexpected error occurred." details={details} />
    </AppThemeProvider>
  );
}
