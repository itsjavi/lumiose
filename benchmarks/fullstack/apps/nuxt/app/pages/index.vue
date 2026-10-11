<script setup lang="ts">
const { data } = await useFetch("/api/dashboard");

useHead({ title: "Dashboard" });
</script>

<template>
  <template v-if="data">
    <h1 class="page-title">Dashboard</h1>
    <DashboardStats :by-status="data.byStatus" :by-priority="data.byPriority" />
    <section class="panel">
      <h2 class="panel-title">Projects</h2>
      <ProjectTable :projects="data.projects" />
    </section>
    <section class="panel">
      <h2 class="panel-title">Recently updated</h2>
      <IssueList :issues="data.recent" test-id="recent-issues" />
    </section>
  </template>
</template>
