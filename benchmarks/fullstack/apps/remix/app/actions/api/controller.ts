import { getIssue, searchIssues } from "@bench/data";
import { createController } from "remix/router";

import { routes } from "../../routes.ts";

// The JSON endpoints of doc-4 §2.
export default createController(routes.api, {
  actions: {
    issue(context) {
      const { id } = context.params;
      const issue = /^\d+$/.test(id) ? getIssue(Number(id)) : undefined;
      if (!issue) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(issue);
    },

    search(context) {
      return Response.json(searchIssues(context.url.searchParams.get("q") ?? "", 8));
    },
  },
});
