import { Title } from "@solidjs/meta";
import { createAsync, type RouteDefinition } from "@solidjs/router";
import { Show } from "solid-js";
import { DashboardStats, IssueList, ProjectTable } from "../components/dashboard.tsx";
import { PageTitle } from "../components/layout.tsx";
import { getDashboard } from "../lib/api.ts";

export const route = {
  preload: () => getDashboard(),
} satisfies RouteDefinition;

export default function Home() {
  const dashboard = createAsync(() => getDashboard(), { deferStream: true });
  return (
    <>
      <Title>Dashboard · Tracker</Title>
      <PageTitle>Dashboard</PageTitle>
      <Show when={dashboard()}>
        {(loaded) => (
          <>
            <DashboardStats byStatus={loaded().byStatus} byPriority={loaded().byPriority} />
            <section class="panel">
              <h2 class="panel-title">Projects</h2>
              <ProjectTable projects={loaded().projects} />
            </section>
            <section class="panel">
              <h2 class="panel-title">Recently updated</h2>
              <IssueList issues={loaded().recent} testId="recent-issues" />
            </section>
          </>
        )}
      </Show>
    </>
  );
}
