// Off-platform funneling is not allowed in chat: external messenger names,
// phone numbers, and email addresses are blocked before a message is saved.
const BANNED_PATTERNS: RegExp[] = [
  /whats\s*app/i,
  /we\s*chat|weixin|微信|加v|加薇/i,
  /telegram|电报/i,
  /\bline\s*(id)?\b.{0,6}(id|号)/i,
  /kakao/i,
  /\bsignal\b/i,
  /\bqq\b|扣扣/i,
  /站外|私下交易|线下(交易|联系)/,
  // phone numbers: 8+ digits allowing spaces/dashes between
  /(?:\+?\d[\s-]?){8,}/,
  // email addresses
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
]

export function containsBannedContent(text: string): boolean {
  return BANNED_PATTERNS.some((re) => re.test(text))
}
