const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`);

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function postJson<TResponse, TPayload extends object>(url: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}
