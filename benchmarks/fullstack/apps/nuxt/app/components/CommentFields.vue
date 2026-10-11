<!-- The comment composer's controls with a live character count; the page owns the form. -->
<script setup lang="ts">
import { COMMENT_MAX } from "@bench/data/format";

defineProps<{ pending: boolean; error?: string }>();
const value = defineModel<string>({ required: true });
</script>

<template>
  <label class="field">
    <span class="field-label">Add a comment</span>
    <textarea
      v-model="value"
      name="body"
      rows="4"
      :maxlength="COMMENT_MAX"
      data-testid="comment-input"
    ></textarea>
  </label>
  <p v-if="error" class="field-error" data-testid="comment-error">{{ error }}</p>
  <div class="composer-footer">
    <span class="char-count" data-testid="char-count">{{ value.length }} / {{ COMMENT_MAX }}</span>
    <button
      type="submit"
      class="btn btn-primary"
      data-testid="comment-submit"
      :disabled="pending || value.trim().length === 0"
    >
      {{ pending ? "Posting…" : "Comment" }}
    </button>
  </div>
</template>
