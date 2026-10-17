import type { ThemeMode } from "@wildchild/design-system";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ErrorPage } from "./components/error-page";
import { AppThemeProvider, readThemeCookie } from "./theme-mode";

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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <AppThemeProvider initialMode="light">
        <ErrorPage title="Not found" message="This page does not exist." />
      </AppThemeProvider>
    );
  }
  const details = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;
  return (
    <AppThemeProvider initialMode="light">
      <ErrorPage title="Something went wrong" message="An unexpected error occurred." details={details} />
    </AppThemeProvider>
  );
}
