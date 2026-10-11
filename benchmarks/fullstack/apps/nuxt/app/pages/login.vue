<script setup lang="ts">
const error = ref<string>();

useHead({ title: "Log in" });

async function login(event: Event) {
  const form = new FormData(event.target as HTMLFormElement);
  const result = await postAction("/api/login", { username: form.get("username") });
  if (!result) return;
  if (!result.ok) {
    error.value = result.errors.username;
    return;
  }
  await refreshNuxtData();
  await navigateTo("/");
}
</script>

<template>
  <h1 class="page-title">Log in</h1>
  <form class="form login-form" @submit.prevent="login">
    <LoginFields :error="error" />
  </form>
</template>
