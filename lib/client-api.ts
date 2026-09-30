// Browser-side fetch wrapper for /api/*. POSTs JSON when a body is given.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    `/api${path}`,
    body === undefined
      ? { credentials: "same-origin" }
      : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong.", res.status);
  return data as T;
}
