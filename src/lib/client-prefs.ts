// Remembers the user's last locale/scope choice per device so the next
// bare visit (no prefix in the URL) lands back where they left off, instead
// of falling back to browser Accept-Language. Read by proxy.ts.
export function setPrefCookie(name: "pref_locale" | "pref_scope", value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
