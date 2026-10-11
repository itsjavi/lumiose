<script setup lang="ts">
const [{ data: user }, { data: projects }] = await Promise.all([
  useFetch("/api/me"),
  useFetch("/api/projects"),
]);

async function logout() {
  await $fetch("/api/logout", { method: "POST" });
  await refreshNuxtData();
  await navigateTo("/");
}
</script>

<template>
  <div class="app">
    <header class="app-header" data-testid="app-header">
      <NuxtLink to="/" class="brand">Tracker</NuxtLink>
      <nav class="nav" data-testid="nav">
        <NuxtLink to="/">Dashboard</NuxtLink>
        <NuxtLink to="/issues/new">New issue</NuxtLink>
        <NuxtLink to="/search">Search</NuxtLink>
      </nav>
      <div class="user" data-testid="current-user">
        <template v-if="user">
          <span class="user-name">{{ user.displayName }}</span>
          <form class="logout-form" @submit.prevent="logout">
            <button type="submit" class="btn btn-link" data-testid="logout-button">Log out</button>
          </form>
        </template>
        <NuxtLink v-else to="/login" data-testid="login-link">Log in</NuxtLink>
      </div>
    </header>
    <div class="app-body">
      <aside class="sidebar" data-testid="sidebar">
        <h2 class="sidebar-title">Projects</h2>
        <ul class="project-list">
          <li v-for="project in projects" :key="project.slug">
            <NuxtLink :to="`/projects/${project.slug}`" data-testid="sidebar-project">
              <span class="project-name">{{ project.name }}</span>
              <span class="count">{{ project.openCount }}</span>
            </NuxtLink>
          </li>
        </ul>
      </aside>
      <main class="main" data-testid="main">
        <slot />
      </main>
    </div>
    <footer class="app-footer" data-testid="app-footer">
      Tracker · fullstack comparison benchmark
    </footer>
  </div>
</template>
