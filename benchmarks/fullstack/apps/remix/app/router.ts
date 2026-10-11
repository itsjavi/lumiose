import { createRouter } from "remix/router";

import apiController from "./actions/api/controller.ts";
import controller from "./actions/controller.tsx";
import issuesController from "./actions/issues/controller.tsx";
import newIssueController from "./actions/issues/new/controller.tsx";
import loginController from "./actions/login/controller.tsx";
import { notFound } from "./actions/not-found.tsx";
import projectsController from "./actions/projects/controller.tsx";
import { type AppContext, middleware } from "./middleware/index.ts";
import { routes } from "./routes.ts";

export const router = createRouter<AppContext>({
  middleware,
  // Anything else: the 404 page inside the layout (doc-4 §2).
  defaultHandler: (context) => notFound(context),
});

router.map(routes, controller);
router.map(routes.login, loginController);
router.map(routes.projects, projectsController);
router.map(routes.issues, issuesController);
router.map(routes.issues.new, newIssueController);
router.map(routes.api, apiController);
