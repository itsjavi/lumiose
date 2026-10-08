# Counter

<button id="count">0</button>

<script type="module">
  const button = document.querySelector("#count");
  button.addEventListener("click", () => (button.textContent = String(Number(button.textContent) + 1)));
</script>
<script src="./analytics.js"></script>
