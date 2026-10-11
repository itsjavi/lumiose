<script lang="ts">
  import { enhance } from "$app/forms";
  import LoginFields from "#lib/components/LoginFields.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<svelte:head>
  <title>Log in · Tracker</title>
</svelte:head>

<h1 class="page-title">Log in</h1>
<form method="POST" class="form login-form" use:enhance>
  <LoginFields username={form?.username ?? ""} error={form?.error} />
</form>
