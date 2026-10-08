<script>
  import Row from "./Row.svelte";
  import Summary from "./Summary.svelte";

  let { data } = $props();
</script>

<div class="page">
  <header class="header">
    <h1>{data.title}</h1>
    <nav>{#each data.links as link}<a href={link.href}>{link.text}</a>{/each}</nav>
  </header>
  <main>
    <table class="table">
      <thead><tr><th>#</th><th>Label</th><th>Price</th><th>Tags</th><th>Status</th></tr></thead>
      <tbody>
        {#each data.items as item (item.id)}<Row {item} />{/each}
      </tbody>
    </table>
  </main>
  <footer class="footer"><Summary items={data.items} /></footer>
</div>
