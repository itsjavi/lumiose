<!-- The login form's fields; the page renders the `<form>` (action) around them. -->
<script lang="ts">
  import Field from "./Field.svelte";

  let { username, error }: { username: string; error: string | undefined } = $props();
</script>

<Field name="username" label="Username" {error}>
  <input id="username" name="username" value={username} autocomplete="username" />
</Field>
<button type="submit" class="btn btn-primary" data-testid="login-submit">Log in</button>
<p class="muted">Try <code>alice</code> or <code>bob</code>.</p>
