<!-- The login form's fields; the page renders the `<form>` around them. -->
<script setup lang="ts">
defineProps<{ error: string | undefined }>();
</script>

<template>
  <Field name="username" label="Username" :error="error">
    <input id="username" name="username" autocomplete="username" />
  </Field>
  <button type="submit" class="btn btn-primary" data-testid="login-submit">Log in</button>
  <p class="muted">Try <code>alice</code> or <code>bob</code>.</p>
</template>
