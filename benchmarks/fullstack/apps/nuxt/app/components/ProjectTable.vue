<script setup lang="ts">
import type { ProjectStats } from "@bench/data/format";

defineProps<{ projects: ProjectStats[] }>();
</script>

<template>
  <table class="table" data-testid="project-table">
    <thead>
      <tr>
        <th>Project</th>
        <th class="num">Open</th>
        <th class="num">In progress</th>
        <th class="num">Closed</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="project in projects" :key="project.slug" data-testid="project-row">
        <td>
          <NuxtLink :to="`/projects/${project.slug}`">{{ project.name }}</NuxtLink>
        </td>
        <td class="num">{{ project.open }}</td>
        <td class="num">{{ project.inProgress }}</td>
        <td class="num">{{ project.closed }}</td>
        <td class="num">{{ project.total }}</td>
      </tr>
    </tbody>
  </table>
</template>
