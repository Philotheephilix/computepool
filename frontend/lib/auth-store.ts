const KEY_USERNAME = "cp_username";
const KEY_API_KEY  = "cp_api_key";

export function saveAuth(username: string, apiKey: string): void {
  localStorage.setItem(KEY_USERNAME, username);
  localStorage.setItem(KEY_API_KEY, apiKey);
}

export function loadAuth(): { username: string; apiKey: string } | null {
  const username = localStorage.getItem(KEY_USERNAME);
  const apiKey   = localStorage.getItem(KEY_API_KEY);
  if (!username || !apiKey) return null;
  return { username, apiKey };
}

export function clearAuth(): void {
  localStorage.removeItem(KEY_USERNAME);
  localStorage.removeItem(KEY_API_KEY);
}
