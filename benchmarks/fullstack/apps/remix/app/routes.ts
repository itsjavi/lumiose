import { form, get, post, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: get("/"),
  search: get("/search"),
  login: form("/login"),
  logout: post("/logout"),
  projects: route("/projects/:slug", {
    show: get("/"),
    // Bulk close: the bulk-select form posts the checked `ids`.
    close: post("/close"),
  }),
  issues: route("/issues", {
    new: form("/new"),
    show: get("/:id"),
    // The issue page's comments: a frame that streams after the page (doc-4 §2).
    comments: get("/:id/comments"),
    comment: post("/:id/comments"),
    status: post("/:id/status"),
  }),
  api: route("/api", {
    issue: get("/issues/:id"),
    search: get("/search"),
  }),
});
