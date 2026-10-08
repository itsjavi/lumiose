<script>
  let { tags } = $props();
</script>

<ul class="tags">
  {#each tags as tag}<li class="tag">{tag}</li>{/each}
</ul>
