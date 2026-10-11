<!-- The project page's issue table with row checkboxes (driven by the page's bulk select). -->
<script lang="ts">
  import { formatDate, type IssueSummary } from "@bench/data/format";
  import LabelList from "./LabelList.svelte";
  import PriorityBadge from "./PriorityBadge.svelte";
  import StatusBadge from "./StatusBadge.svelte";

  let {
    issues,
    selected,
    onToggle,
    onToggleAll,
  }: {
    issues: IssueSummary[];
    selected: ReadonlySet<number>;
    onToggle: (id: number) => void;
    onToggleAll: () => void;
  } = $props();

  const allSelected = $derived(
    issues.length > 0 && issues.every((issue) => selected.has(issue.id)),
  );
</script>

<table class="table issue-table" data-testid="issue-table">
  <thead>
    <tr>
      <th class="col-check">
        <input
          type="checkbox"
          aria-label="Select all"
          data-testid="select-all"
          checked={allSelected}
          onchange={onToggleAll}
        />
      </th>
      <th class="num">#</th>
      <th>Title</th>
      <th>Status</th>
      <th>Priority</th>
      <th>Assignee</th>
      <th class="num">Comments</th>
      <th>Updated</th>
    </tr>
  </thead>
  <tbody>
    {#each issues as issue (issue.id)}
      <tr data-testid="issue-row" data-issue-id={issue.id}>
        <td class="col-check">
          <input
            type="checkbox"
            name="ids"
            value={issue.id}
            aria-label="Select issue #{issue.id}"
            data-testid="row-select"
            checked={selected.has(issue.id)}
            onchange={() => onToggle(issue.id)}
          />
        </td>
        <td class="num muted">{issue.id}</td>
        <td class="col-title">
          <a href="/issues/{issue.id}" class="issue-link">{issue.title}</a>
          <LabelList labels={issue.labels} />
        </td>
        <td><StatusBadge status={issue.status} /></td>
        <td><PriorityBadge priority={issue.priority} /></td>
        <td>
          {#if issue.assignee}{issue.assignee.displayName}{:else}<span class="muted"
              >Unassigned</span
            >{/if}
        </td>
        <td class="num">{issue.commentCount}</td>
        <td><time datetime={issue.updatedAt}>{formatDate(issue.updatedAt)}</time></td>
      </tr>
    {/each}
  </tbody>
</table>
