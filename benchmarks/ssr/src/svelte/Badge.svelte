<script>
  let { kind, children } = $props();
</script>

<span class="badge {kind}">{@render children()}</span>
