<script>
  import { formatPrice } from "../data.ts";
  import Badge from "./Badge.svelte";
  import Tags from "./Tags.svelte";

  let { item } = $props();
</script>

<tr class={item.active ? "row active" : "row"} data-id={item.id}>
  <td class="id">{item.id}</td>
  <td class="label"><a href={item.url} title={item.label}>{item.label}</a><p>{item.description}</p></td>
  <td class="price">{formatPrice(item.price)}</td>
  <td class="tags"><Tags tags={item.tags} /></td>
  <td class="status">
    {#if item.active}<Badge kind="ok">active</Badge>{:else}<Badge kind="off">inactive</Badge>{/if}
  </td>
</tr>
