import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("api/edits", "routes/api.edits.ts"),
  route("api/changes", "routes/api.changes.ts"),
  route("api/agent/*", "routes/api.agent.ts"),
  route("api/pages", "routes/api.pages.ts"),
  route("api/content", "routes/api.content.ts"),
  route("content/:id", "routes/content.ts"),
  route("api/suggestions", "routes/api.suggestions.ts"),
  route("api/comments/:commentId/editable", "routes/api.comment-editable.ts"),
  route("new", "routes/create.ts"),
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
