import { createIssue, listLabels, listProjects, parseLabels, validateIssue } from "@bench/data";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { requireUser } from "../../../middleware/session.ts";
import { routes } from "../../../routes.ts";
import { renderPage } from "../../page.tsx";
import { EMPTY_ISSUE_FORM, NewIssuePage, type IssueFormValues } from "./page.tsx";

export default createController(routes.issues.new, {
  actions: {
    index(context) {
      return renderPage(
        context,
        "New issue",
        <NewIssuePage
          projects={listProjects()}
          labels={listLabels()}
          values={EMPTY_ISSUE_FORM}
          errors={{}}
        />,
      );
    },

    action: {
      middleware: [requireUser()],
      handler(context) {
        const input = Object.fromEntries(context.formData);
        const result = validateIssue(input);
        if (!result.ok) {
          // Render the form again with the submitted values and the field errors.
          const values: IssueFormValues = {
            title: String(input.title ?? ""),
            body: String(input.body ?? ""),
            project: String(input.project ?? ""),
            priority: String(input.priority ?? ""),
            labels: parseLabels(input.labels),
          };
          return renderPage(
            context,
            "New issue",
            <NewIssuePage
              projects={listProjects()}
              labels={listLabels()}
              values={values}
              errors={result.errors}
            />,
            { status: 400 },
          );
        }
        const id = createIssue(result.value, context.currentUser!.id);
        return redirect(routes.issues.show.href({ id: String(id) }), 303);
      },
    },
  },
});
