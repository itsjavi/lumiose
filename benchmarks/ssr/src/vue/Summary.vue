<script>
import { formatPrice } from "../data.ts";

export default {
  props: ["items"],
  setup(props) {
    let active = 0;
    let total = 0;
    for (const item of props.items) {
      if (item.active) active++;
      total += item.price;
    }
    return { active, total, formatPrice };
  },
};
</script>

<template>
  <p>{{ items.length }} items, {{ active }} active, total {{ formatPrice(total) }}</p>
</template>
