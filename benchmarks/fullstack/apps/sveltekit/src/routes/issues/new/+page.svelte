<script lang="ts">
  import { enhance } from "$app/forms";
  import IssueFormFields from "#lib/components/IssueFormFields.svelte";
  import { EMPTY_ISSUE_FORM } from "#lib/issue-form.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let pending = $state(false);
</script>

<svelte:head>
  <title>New issue · Tracker</title>
</svelte:head>

<h1 class="page-title">New issue</h1>
<form
  method="POST"
  class="form issue-form"
  use:enhance={() => {
    pending = true;
    return async ({ update }) => {
      // Keep what the user typed when validation fails, as a re-rendered native form would.
      await update({ reset: false });
      pending = false;
    };
  }}
>
  <IssueFormFields
    projects={data.projects}
    labels={data.labels}
    values={form?.values ?? EMPTY_ISSUE_FORM}
    errors={form?.errors ?? {}}
    {pending}
  />
</form>
