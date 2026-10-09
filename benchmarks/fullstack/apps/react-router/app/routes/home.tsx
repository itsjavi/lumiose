import { getDashboard } from "@bench/data";
import { DashboardStats, IssueList, PageTitle, ProjectTable } from "@bench/react-ui";
import { AppLink } from "../lib/link";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [{ title: "Dashboard · Tracker" }];

export function loader() {
  return getDashboard();
}

export default function Home({ loaderData: dashboard }: Route.ComponentProps) {
  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      <DashboardStats byStatus={dashboard.byStatus} byPriority={dashboard.byPriority} />
      <section className="panel">
        <h2 className="panel-title">Projects</h2>
        <ProjectTable Link={AppLink} projects={dashboard.projects} />
      </section>
      <section className="panel">
        <h2 className="panel-title">Recently updated</h2>
        <IssueList Link={AppLink} issues={dashboard.recent} testId="recent-issues" />
      </section>
    </>
  );
}
