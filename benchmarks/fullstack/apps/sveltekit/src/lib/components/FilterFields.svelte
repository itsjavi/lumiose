<!-- The controls of the project page's GET filter form; the page renders the `<form>` itself. -->
<script lang="ts">
  import {
    PRIORITIES,
    PRIORITY_LABELS,
    SORTS,
    SORT_LABELS,
    STATUSES,
    STATUS_LABELS,
    type IssueFilters,
    type Label,
  } from "@bench/data/format";

  let { filters, labels }: { filters: IssueFilters; labels: Label[] } = $props();
</script>

<label class="filter">
  <span>Status</span>
  <select name="status" value={filters.status ?? ""}>
    <option value="">Any</option>
    {#each STATUSES as status (status)}
      <option value={status}>{STATUS_LABELS[status]}</option>
    {/each}
  </select>
</label>
<label class="filter">
  <span>Priority</span>
  <select name="priority" value={filters.priority ?? ""}>
    <option value="">Any</option>
    {#each PRIORITIES as priority (priority)}
      <option value={priority}>{PRIORITY_LABELS[priority]}</option>
    {/each}
  </select>
</label>
<label class="filter">
  <span>Label</span>
  <select name="label" value={filters.label ?? ""}>
    <option value="">Any</option>
    {#each labels as label (label.id)}
      <option value={label.name}>{label.name}</option>
    {/each}
  </select>
</label>
<label class="filter">
  <span>Sort</span>
  <select name="sort" value={filters.sort}>
    {#each SORTS as sort (sort)}
      <option value={sort}>{SORT_LABELS[sort]}</option>
    {/each}
  </select>
</label>
<label class="filter filter-q">
  <span>Title</span>
  <input type="search" name="q" value={filters.q ?? ""} placeholder="Filter by title" />
</label>
<button type="submit" class="btn" data-testid="filter-submit">Apply</button>
