import { getDashboard, searchIssues } from "@bench/data";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { assets } from "../assets.ts";
import { sessionCookie } from "../middleware/session.ts";
import { routes } from "../routes.ts";
import { DashboardStats, IssueList, ProjectTable } from "../ui/dashboard.tsx";
import { SearchResults } from "../ui/search.tsx";
import { renderPage } from "./page.tsx";
import { SearchBox } from "./search/public/search-box.tsx";

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response("Not Found", { status: 404 });
    },

    home(context) {
      const dashboard = getDashboard();
      return renderPage(
        context,
        "Dashboard",
        <>
          <h1 class="page-title">Dashboard</h1>
          <DashboardStats byStatus={dashboard.byStatus} byPriority={dashboard.byPriority} />
          <section class="panel">
            <h2 class="panel-title">Projects</h2>
            <ProjectTable projects={dashboard.projects} />
          </section>
          <section class="panel">
            <h2 class="panel-title">Recently updated</h2>
            <IssueList issues={dashboard.recent} testId="recent-issues" />
          </section>
        </>,
      );
    },

    search(context) {
      const q = context.url.searchParams.get("q")?.trim() ?? "";
      return renderPage(
        context,
        "Search",
        <>
          <h1 class="page-title">Search</h1>
          <form method="get" action={routes.search.href()} class="search-form" role="search">
            <SearchBox key={q} defaultValue={q} />
          </form>
          {q ? <SearchResults hits={searchIssues(q)} /> : null}
        </>,
      );
    },

    async logout() {
      return redirect(routes.home.href(), {
        status: 303,
        headers: { "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }) },
      });
    },
  },
});
