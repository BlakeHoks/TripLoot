// Remembers an invite token across the magic-link round trip.
const KEY = 'pendingInviteToken'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidToken(token: string | undefined | null): token is string {
  return !!token && UUID_RE.test(token)
}

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // storage unavailable (private mode) — the user can reopen the link
  }
}

export function getPendingInvite(): string | null {
  try {
    const token = localStorage.getItem(KEY)
    return isValidToken(token) ? token : null
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** Where to send a freshly signed-in user. */
export function postLoginPath(): string {
  const token = getPendingInvite()
  return token ? `/join/${token}` : '/'
}
