<script lang="ts">
  let { body }: { body: string } = $props();
</script>

<div class="issue-body" data-testid="issue-body">
  {#each body.split(/\n{2,}/) as paragraph, i (i)}
    <p>{paragraph}</p>
  {/each}
</div>
