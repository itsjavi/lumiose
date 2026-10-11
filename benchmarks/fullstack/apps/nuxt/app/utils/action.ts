// Mutations post JSON to the app's server routes with `$fetch`. Without a session the route answers
// 401 and the page goes to /login, as the other apps' actions redirect there.

/** Field errors of a failed validation (the route's 400 body). */
export type FieldErrors = Partial<Record<string, string>>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

function failure(error: unknown): { status?: number; errors?: FieldErrors } {
  if (typeof error !== "object" || error === null) return {};
  const { statusCode, data } = error as { statusCode?: number; data?: { errors?: FieldErrors } };
  return { status: statusCode, errors: data?.errors };
}

export async function postAction<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<ActionResult<T> | undefined> {
  try {
    return { ok: true, data: (await $fetch(url, { method: "POST", body })) as T };
  } catch (error) {
    const { status, errors } = failure(error);
    if (status === 401) {
      await navigateTo("/login");
      return undefined;
    }
    if (status === 400 && errors) return { ok: false, errors };
    throw error;
  }
}
