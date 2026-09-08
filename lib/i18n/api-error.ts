// Client-side localization of API error responses (i18n step 4).
//
// Server routes return { code: 'INSUFFICIENT_CREDITS', message: 'English…' }.
// UI code must NEVER display `message` directly — call localizeApiError()
// which maps the stable `code` to the active locale's `t.errors.*` string and
// only falls back to the English `message` for codes we haven't translated
// yet (so nothing ever renders blank).
//
// Usage:
//   const { t } = useLanguage()
//   const data = await res.json().catch(() => ({}))
//   alert(localizeApiError(t, data))

export interface ApiErrorBody {
  code?: string
  message?: string
  error?: string
  [key: string]: unknown
}

/** Translation slice this helper needs; `errors` may not exist on old builds. */
interface WithErrors {
  errors?: Record<string, string>
}

export function localizeApiError(
  t: WithErrors | Record<string, unknown>,
  body: ApiErrorBody | null | undefined,
  fallback?: string,
): string {
  const errors = (t as WithErrors).errors
  const code = body?.code
  if (code && errors && errors[code]) return errors[code]
  return (
    body?.message ||
    body?.error ||
    fallback ||
    (errors && errors.SERVER_ERROR) ||
    'Something went wrong. Please try again.'
  )
}
