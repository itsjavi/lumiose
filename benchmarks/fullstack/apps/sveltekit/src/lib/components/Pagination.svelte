<script lang="ts">
  let {
    page,
    totalPages,
    hrefFor,
  }: { page: number; totalPages: number; hrefFor: (page: number) => string } = $props();
</script>

{#if totalPages > 1}
  <nav class="pagination" data-testid="pagination" aria-label="Pagination">
    {#if page > 1}
      <a href={hrefFor(page - 1)} rel="prev" class="btn" data-testid="page-prev">Previous</a>
    {:else}
      <span class="btn disabled">Previous</span>
    {/if}
    <span class="page-info" data-testid="page-info">Page {page} of {totalPages}</span>
    {#if page < totalPages}
      <a href={hrefFor(page + 1)} rel="next" class="btn" data-testid="page-next">Next</a>
    {:else}
      <span class="btn disabled">Next</span>
    {/if}
  </nav>
{/if}
