<script lang="ts">
  import { PAGE_SIZE, issueListHref, plural } from "@bench/data/format";
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
  import BulkBar from "#lib/components/BulkBar.svelte";
  import FilterFields from "#lib/components/FilterFields.svelte";
  import IssueTable from "#lib/components/IssueTable.svelte";
  import Pagination from "#lib/components/Pagination.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let selected = $state<ReadonlySet<number>>(new Set());
  let pending = $state(false);

  const toggleAll = () => {
    selected = data.items.every((issue) => selected.has(issue.id))
      ? new Set()
      : new Set(data.items.map((issue) => issue.id));
  };
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    selected = next;
  };
  // A relative `?/close` would drop the filters from the URL the page reloads after the action.
  const closeAction = $derived(`${page.url.search ? `${page.url.search}&` : "?"}/close`);
</script>

<svelte:head>
  <title>{data.project.name} · Tracker</title>
</svelte:head>

<header class="page-header">
  <h1 class="page-title">{data.project.name}</h1>
  <p class="muted" data-testid="issue-total">{plural(data.total, "issue")}</p>
</header>
<!-- SvelteKit's router turns GET form submissions into client-side navigations. -->
<form method="GET" class="filters">
  <FilterFields filters={data.filters} labels={data.labels} />
</form>
<!-- Row checkboxes and "Close selected"; the page's data reloads after the action. -->
<form
  method="POST"
  action={closeAction}
  class="bulk-form"
  use:enhance={() => {
    // The form data is already read: clear the selection now.
    selected = new Set();
    pending = true;
    return async ({ update }) => {
      await update({ reset: false });
      pending = false;
    };
  }}
>
  <IssueTable issues={data.items} {selected} onToggle={toggle} onToggleAll={toggleAll} />
  <BulkBar count={selected.size} {pending} />
</form>
<Pagination
  page={data.filters.page}
  totalPages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
  hrefFor={(n: number) => issueListHref(data.project.slug, data.filters, { page: n })}
/>
