// Shared helpers for the KOL discovery proxy routes.

export const KOL_API_URL = process.env.KOL_API_URL || 'http://localhost:8000'

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

// Brands must not see creator contact info: drop contact_email entirely and
// redact addresses that appear inside free-text fields like the bio.
export function sanitizeCreator(creator: Record<string, any>) {
  const { contact_email, ...rest } = creator
  if (typeof rest.bio === 'string') {
    rest.bio = rest.bio.replace(EMAIL_RE, '•••')
  }
  return rest
}

export function sanitizeResults<T extends { results?: any[] }>(data: T): T {
  if (Array.isArray(data?.results)) {
    data.results = data.results.map(sanitizeCreator)
  }
  return data
}
