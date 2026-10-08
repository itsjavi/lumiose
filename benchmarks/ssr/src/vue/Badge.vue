<script>
export default { props: ["kind"] };
</script>

<template>
  <span :class="`badge ${kind}`"><slot /></span>
</template>
