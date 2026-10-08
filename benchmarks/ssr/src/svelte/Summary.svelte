<script>
  import { formatPrice } from "../data.ts";

  let { items } = $props();
  let active = 0;
  let total = 0;
  for (const item of items) {
    if (item.active) active++;
    total += item.price;
  }
</script>

<p>{items.length} items, {active} active, total {formatPrice(total)}</p>
