import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '../src/normalizer.js'

describe('normalizeUrl', () => {
  it('strips trailing slash from non-root paths', () => {
    const { normalized } = normalizeUrl('https://example.com/path/')
    expect(normalized.endsWith('/')).toBe(false)
  })

  it('strips www prefix', () => {
    const { normalized, domain } = normalizeUrl('https://www.example.com/path')
    expect(normalized).not.toContain('www.')
    expect(domain).toBe('example.com')
  })

  it('lowercases the hostname', () => {
    const { normalized, domain } = normalizeUrl('https://EXAMPLE.COM/Path')
    expect(domain).toBe('example.com')
    expect(normalized.startsWith('https://example.com')).toBe(true)
  })

  it('removes utm_source tracking param', () => {
    const { normalized } = normalizeUrl('https://example.com/page?utm_source=google&id=1')
    expect(normalized).not.toContain('utm_source')
    expect(normalized).toContain('id=1')
  })

  it('removes fbclid tracking param', () => {
    const { normalized } = normalizeUrl('https://example.com/page?fbclid=abc123')
    expect(normalized).not.toContain('fbclid')
  })

  it('removes igshid tracking param', () => {
    const { normalized } = normalizeUrl('https://www.instagram.com/someuser/?igshid=xyz')
    expect(normalized).not.toContain('igshid')
  })

  it('normalizes instagram profile — strips query params', () => {
    const { normalized } = normalizeUrl('https://www.instagram.com/beautyqueen/?hl=en&ref=something')
    expect(normalized).toBe('https://instagram.com/beautyqueen')
  })

  it('normalizes instagram profile — strips /reels/ sub-path', () => {
    const { normalized } = normalizeUrl('https://www.instagram.com/beautyqueen/reels/')
    expect(normalized).toBe('https://instagram.com/beautyqueen')
  })

  it('normalizes tiktok @handle — adds @ prefix if missing', () => {
    const { normalized } = normalizeUrl('https://www.tiktok.com/beautyqueen')
    expect(normalized).toBe('https://tiktok.com/@beautyqueen')
  })

  it('normalizes tiktok — strips /video/ sub-path', () => {
    const { normalized } = normalizeUrl('https://www.tiktok.com/@creator123/video/12345')
    expect(normalized).toBe('https://tiktok.com/@creator123')
  })

  it('normalizes youtube @handle', () => {
    const { normalized } = normalizeUrl('https://www.youtube.com/@mychannel/videos')
    expect(normalized).toBe('https://youtube.com/@mychannel')
  })

  it('normalizes youtube /channel/UC... path', () => {
    const { normalized } = normalizeUrl('https://www.youtube.com/channel/UCxxABCDEF')
    expect(normalized).toBe('https://youtube.com/channel/UCxxABCDEF')
  })

  it('normalizes youtube /c/name path', () => {
    const { normalized } = normalizeUrl('https://www.youtube.com/c/MyChannel')
    expect(normalized).toBe('https://youtube.com/c/mychannel')
  })

  it('handles malformed URLs gracefully — returns original', () => {
    const result = normalizeUrl('not a url !!!')
    expect(result.normalized).toBe('not a url !!!')
    expect(result.domain).toBe('')
  })

  it('returns correct domain for normal URLs', () => {
    const { domain } = normalizeUrl('https://www.linktr.ee/somehandle')
    expect(domain).toBe('linktr.ee')
  })
})
