import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("projects/:slug", "routes/project.tsx"),
  route("issues/new", "routes/new-issue.tsx"),
  route("issues/:id", "routes/issue.tsx"),
  route("search", "routes/search.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("api/issues/:id", "routes/api.issue.ts"),
  route("api/search", "routes/api.search.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
