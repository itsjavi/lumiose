// The dashboard: status and priority stat cards, the per-project table and the 10 most recently
// updated issues. No islands.
import { Title } from "lumiose";
import { DashboardStats, IssueList, ProjectTable } from "../components/dashboard.tsx";
import { ReadyScript } from "../components/layout.tsx";
import { getDashboard } from "../server/data.ts";

export default function DashboardPage() {
  const dashboard = getDashboard();
  return (
    <>
      <Title>Dashboard · Tracker</Title>
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
      <ReadyScript />
    </>
  );
}
