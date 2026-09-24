const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export function formatAmount(n: number): string {
  return numberFormat.format(n)
}

export function displayName(profile: { display_name: string | null } | null | undefined, fallback = 'Someone') {
  return profile?.display_name?.trim() || fallback
}

/** Email prefix as a display-name fallback for the current user. */
export function emailName(email: string | undefined | null): string {
  return email?.split('@')[0] || 'You'
}
