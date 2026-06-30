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

export async function postFormData<TResponse>(url: string, payload: FormData): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    body: payload,
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function putJson<TResponse, TPayload extends object>(url: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PUT"
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function patchJson<TResponse, TPayload extends object>(url: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function deleteJson(url: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }
}
