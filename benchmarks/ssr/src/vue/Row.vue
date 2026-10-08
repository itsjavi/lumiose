<script>
import { formatPrice } from "../data.ts";
import Badge from "./Badge.vue";
import Tags from "./Tags.vue";

export default { props: ["item"], components: { Badge, Tags }, methods: { formatPrice } };
</script>

<template>
  <tr :class="item.active ? 'row active' : 'row'" :data-id="item.id">
    <td class="id">{{ item.id }}</td>
    <td class="label">
      <a :href="item.url" :title="item.label">{{ item.label }}</a>
      <p>{{ item.description }}</p>
    </td>
    <td class="price">{{ formatPrice(item.price) }}</td>
    <td class="tags"><Tags :tags="item.tags" /></td>
    <td class="status">
      <Badge v-if="item.active" kind="ok">active</Badge>
      <Badge v-else kind="off">inactive</Badge>
    </td>
  </tr>
</template>
