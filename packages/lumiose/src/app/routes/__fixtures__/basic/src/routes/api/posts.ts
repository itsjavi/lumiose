export const mode = "server";

export function GET(): Response {
  return Response.json([]);
}

export function POST(): Response {
  return new Response(null, { status: 201 });
}
