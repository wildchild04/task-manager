import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/shell.tsx", [
    index("routes/home.tsx"),
    route("pages/:pageId", "routes/page.tsx"),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
