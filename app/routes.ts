import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("api/edits", "routes/api.edits.ts"),
  layout("routes/shell.tsx", [
    index("routes/home.tsx"),
    route("projects/:projectId", "routes/project-home.tsx"),
    route("projects/:projectId/library", "routes/library.tsx"),
    route("projects/:projectId/:list", "routes/task-list.tsx"),
    route("tasks/:taskId", "routes/task.tsx"),
    route("pages/:pageId", "routes/page.tsx"),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
