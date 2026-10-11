<script setup lang="ts">
import { formatDate, plural, type Comment } from "@bench/data/format";

defineProps<{ comments: Comment[] }>();
</script>

<template>
  <p class="muted" data-testid="comment-count">{{ plural(comments.length, "comment") }}</p>
  <ol class="comment-list" data-testid="comment-list">
    <li v-for="comment in comments" :key="comment.id" class="comment" data-testid="comment">
      <div class="comment-meta">
        <strong>{{ comment.author.displayName }}</strong>
        <time :datetime="comment.createdAt">{{ formatDate(comment.createdAt) }}</time>
      </div>
      <p class="comment-body">{{ comment.body }}</p>
    </li>
  </ol>
</template>
