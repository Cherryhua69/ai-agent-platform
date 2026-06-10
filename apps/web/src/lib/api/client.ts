const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`);

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}
