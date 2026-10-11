export function NotFound() {
  return () => (
    <section class="not-found" data-testid="not-found">
      <h1 class="page-title">Page not found</h1>
      <p class="muted">The page you are looking for does not exist.</p>
      <a href="/" class="btn">
        Back to the dashboard
      </a>
    </section>
  );
}
