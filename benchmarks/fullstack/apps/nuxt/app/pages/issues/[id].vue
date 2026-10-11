<script setup lang="ts">
// Numeric ids only: anything else is the router's 404, like an unknown URL.
definePageMeta({ path: "/issues/:id(\\d+)" });

const id = Number(useRoute().params.id);
const { data: issue, error, refresh } = await useFetch(`/api/issues/${id}`);
if (error.value) throw createError({ ...error.value, fatal: true });

// Nuxt renders pages to a string (no out-of-order streaming): the comments, the page's slow data,
// load on the client after hydration, behind the fallback that the server renders.
const comments = useLazyFetch(`/api/issues/${id}/comments`, { server: false });

useHead({ title: () => (issue.value ? `#${issue.value.id} ${issue.value.title}` : "") });

// The status form's selection, reset to the stored status whenever the issue reloads.
const status = ref(issue.value!.status);
watch(
  () => issue.value?.status,
  (value) => value && (status.value = value),
);

const body = ref("");
const commentError = ref<string>();
const posting = ref(false);
const updating = ref(false);

async function postComment() {
  posting.value = true;
  try {
    const result = await postAction(`/api/issues/${id}/comments`, { body: body.value });
    if (!result) return;
    if (!result.ok) {
      commentError.value = result.errors.body;
      return;
    }
    commentError.value = undefined;
    body.value = "";
    await comments.refresh();
  } finally {
    posting.value = false;
  }
}

async function updateStatus() {
  updating.value = true;
  try {
    if (await postAction(`/api/issues/${id}/status`, { status: status.value })) await refresh();
  } finally {
    updating.value = false;
  }
}
</script>

<template>
  <template v-if="issue">
    <IssueHeader :issue="issue" />
    <div class="issue-layout">
      <div class="issue-main">
        <IssueBody :body="issue.body" />
        <section class="comments" aria-label="Comments">
          <h2 class="panel-title">Comments</h2>
          <CommentList v-if="comments.data.value" :comments="comments.data.value" />
          <CommentsFallback v-else />
          <!-- Textarea with a live character count; posts the comment and clears itself on success. -->
          <form class="comment-form" @submit.prevent="postComment">
            <CommentFields v-model="body" :pending="posting" :error="commentError" />
          </form>
        </section>
      </div>
      <aside class="issue-side">
        <IssueDetails :issue="issue" />
        <form class="status-form" @submit.prevent="updateStatus">
          <StatusFields v-model="status" :pending="updating" />
        </form>
      </aside>
    </div>
  </template>
</template>
