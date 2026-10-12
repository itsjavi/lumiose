export function GET(): Response {
  return new Response("<urlset/>", { headers: { "content-type": "application/xml" } });
}
