<script>
export default { props: ["tags"] };
</script>

<template>
  <ul class="tags">
    <li v-for="(tag, index) in tags" :key="index" class="tag">{{ tag }}</li>
  </ul>
</template>
