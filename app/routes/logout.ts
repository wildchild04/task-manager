import { redirect } from "react-router";

import { logoutAction } from "../lib/account.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/logout";

/** Ends this browser's session and goes to sign in. */
export function action({ request }: Route.ActionArgs) {
  const { setCookie } = logoutAction(services, request);
  return redirect("/login", { headers: { "Set-Cookie": setCookie } });
}

export function loader() {
  return redirect("/");
}
