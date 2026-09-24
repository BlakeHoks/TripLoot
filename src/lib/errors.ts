type ErrorLike = {
  code?: string
  message?: string
  status?: number
  name?: string
}

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === 'object') return error as ErrorLike
  return { message: String(error) }
}

/** Turns Supabase / Postgres / network errors into something a human can read. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = asErrorLike(error)
  const message = e.message ?? ''

  if (message === 'invite_invalid') return 'This invite link is invalid, revoked or expired.'
  if (message === 'not_authenticated' || e.code === '28000') return 'Please sign in again.'

  if (e.name === 'TypeError' && /fetch|network/i.test(message)) return 'Network error — check your connection.'
  if (/failed to fetch|network ?error|load failed/i.test(message)) return 'Network error — check your connection.'

  // Supabase Auth
  if (e.status === 429 || /rate limit|security purposes/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (/invalid email|unable to validate email|email address .* is invalid/i.test(message)) {
    return 'Please enter a valid email address.'
  }
  if (/signups not allowed/i.test(message)) return 'Sign-ups are disabled for this app.'
  if (e.code === 'otp_expired' || /token has expired or is invalid|otp.*(expired|invalid)/i.test(message)) {
    return 'This login link is invalid or has expired. Request a new one.'
  }

  // Postgres / PostgREST
  switch (e.code) {
    case '42501':
      return "You don't have permission to do that."
    case '23505':
      return 'That already exists.'
    case '23503':
      return 'That item no longer exists.'
    case '23514':
    case '22001':
      return 'Some of the values are invalid or too long.'
    case '22P02':
      return 'Invalid link or identifier.'
    case 'PGRST116':
      return 'Not found.'
  }

  return fallback
}
