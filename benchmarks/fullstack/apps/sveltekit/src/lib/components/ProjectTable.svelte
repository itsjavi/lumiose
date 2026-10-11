<script lang="ts">
  import type { ProjectStats } from "@bench/data/format";

  let { projects }: { projects: ProjectStats[] } = $props();
</script>

<table class="table" data-testid="project-table">
  <thead>
    <tr>
      <th>Project</th>
      <th class="num">Open</th>
      <th class="num">In progress</th>
      <th class="num">Closed</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>
    {#each projects as project (project.slug)}
      <tr data-testid="project-row">
        <td><a href="/projects/{project.slug}">{project.name}</a></td>
        <td class="num">{project.open}</td>
        <td class="num">{project.inProgress}</td>
        <td class="num">{project.closed}</td>
        <td class="num">{project.total}</td>
      </tr>
    {/each}
  </tbody>
</table>
