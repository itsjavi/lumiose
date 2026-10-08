<script>
import Row from "./Row.vue";
import Summary from "./Summary.vue";

export default { props: ["data"], components: { Row, Summary } };
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>{{ data.title }}</h1>
      <nav>
        <a v-for="link in data.links" :key="link.href" :href="link.href">{{ link.text }}</a>
      </nav>
    </header>
    <main>
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Label</th>
            <th>Price</th>
            <th>Tags</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <Row v-for="item in data.items" :key="item.id" :item="item" />
        </tbody>
      </table>
    </main>
    <footer class="footer"><Summary :items="data.items" /></footer>
  </div>
</template>
