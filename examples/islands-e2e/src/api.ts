// Isomorphic data access: in-process on the server (with a delay per member), `fetch` in the
// browser. The e2e test counts the browser's `/api/` requests to prove hydration never refetches.
export interface Member {
  id: string;
  name: string;
}

const NAMES: Record<string, string> = { ada: "Ada", bob: "Bob", slow: "Slow Sam" };

/** Server only: the slow member's delay in ms (the server sets it from `?slow=`). */
export const delays = { slow: 600 };

/** Server only: the member, after a delay (the slow one streams after the shell). */
export async function loadMember(id: string): Promise<Member> {
  await new Promise((resolve) => setTimeout(resolve, id === "slow" ? delays.slow : 5));
  return { id, name: NAMES[id] ?? id };
}

export async function getMember(id: string): Promise<Member> {
  if (import.meta.env.SSR) return loadMember(id);
  const response = await fetch(`/api/member/${id}`);
  return (await response.json()) as Member;
}
