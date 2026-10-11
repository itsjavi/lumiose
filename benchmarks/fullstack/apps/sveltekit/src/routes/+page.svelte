<script lang="ts">
  import DashboardStats from "#lib/components/DashboardStats.svelte";
  import IssueList from "#lib/components/IssueList.svelte";
  import ProjectTable from "#lib/components/ProjectTable.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Dashboard · Tracker</title>
</svelte:head>

<h1 class="page-title">Dashboard</h1>
<DashboardStats byStatus={data.byStatus} byPriority={data.byPriority} />
<section class="panel">
  <h2 class="panel-title">Projects</h2>
  <ProjectTable projects={data.projects} />
</section>
<section class="panel">
  <h2 class="panel-title">Recently updated</h2>
  <IssueList issues={data.recent} testId="recent-issues" />
</section>
