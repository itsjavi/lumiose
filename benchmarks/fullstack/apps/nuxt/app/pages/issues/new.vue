<script setup lang="ts">
const [{ data: projects }, { data: labels }] = await Promise.all([
  useFetch("/api/projects"),
  useFetch("/api/labels"),
]);

useHead({ title: "New issue" });

const errors = ref<FieldErrors>({});
const pending = ref(false);

async function create(event: Event) {
  const input = Object.fromEntries(new FormData(event.target as HTMLFormElement));
  pending.value = true;
  try {
    const result = await postAction<{ id: number }>("/api/issues", input);
    if (!result) return;
    if (!result.ok) {
      // The form keeps what the user typed; only the errors change.
      errors.value = result.errors;
      return;
    }
    await navigateTo(`/issues/${result.data.id}`);
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <h1 class="page-title">New issue</h1>
  <form class="form issue-form" @submit.prevent="create">
    <IssueFormFields
      :projects="projects ?? []"
      :labels="labels ?? []"
      :errors="errors"
      :pending="pending"
    />
  </form>
</template>
