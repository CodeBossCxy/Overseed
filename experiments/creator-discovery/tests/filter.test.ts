import { describe, it, expect } from 'vitest'
import { filterUrl } from '../src/filter.js'

describe('filterUrl', () => {
  it('keeps normal Instagram profiles', () => {
    const result = filterUrl('https://instagram.com/beautyqueen', 'instagram_profile', null, null)
    expect(result.keep).toBe(true)
  })

  it('keeps normal TikTok profiles', () => {
    const result = filterUrl('https://tiktok.com/@fitnessguru', 'tiktok_profile', null, null)
    expect(result.keep).toBe(true)
  })

  it('keeps creator websites', () => {
    const result = filterUrl('https://janedoe.com', 'creator_website', 'Jane Doe', 'Beauty blogger')
    expect(result.keep).toBe(true)
  })

  it('keeps link-in-bio URLs', () => {
    const result = filterUrl('https://linktr.ee/somehandle', 'link_in_bio', null, null)
    expect(result.keep).toBe(true)
  })

  it('filters social platform homepage — instagram.com with no path', () => {
    const result = filterUrl('https://instagram.com/', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/homepage/)
  })

  it('filters social platform homepage — tiktok.com with no path', () => {
    const result = filterUrl('https://tiktok.com/', 'unknown', null, null)
    expect(result.keep).toBe(false)
  })

  it('filters login pages', () => {
    const result = filterUrl('https://instagram.com/accounts/login/', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/login/)
  })

  it('filters signup pages', () => {
    const result = filterUrl('https://tiktok.com/signup', 'unknown', null, null)
    expect(result.keep).toBe(false)
  })

  it('filters explore pages', () => {
    const result = filterUrl('https://instagram.com/explore/tags/beauty/', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/search\/explore/)
  })

  it('filters search result pages', () => {
    const result = filterUrl('https://youtube.com/results?search_query=beauty', 'unknown', null, null)
    expect(result.keep).toBe(false)
  })

  it('filters discover pages', () => {
    const result = filterUrl('https://tiktok.com/discover', 'unknown', null, null)
    expect(result.keep).toBe(false)
  })

  it('filters privacy pages', () => {
    const result = filterUrl('https://instagram.com/privacy', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/legal\/policy/)
  })

  it('filters terms pages', () => {
    const result = filterUrl('https://example.com/terms', 'unknown', null, null)
    expect(result.keep).toBe(false)
  })

  it('filters search engine URLs', () => {
    const result = filterUrl('https://google.com/search?q=beauty+influencer', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/search engine/)
  })

  it('filters app store URLs', () => {
    const result = filterUrl('https://apps.apple.com/app/instagram/id389801252', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/app store/)
  })

  it('filters ecommerce paths on non-creator domains', () => {
    const result = filterUrl('https://bigshop.com/product/some-item', 'unknown', null, null)
    expect(result.keep).toBe(false)
    expect(result.reason).toMatch(/ecommerce/)
  })

  it('keeps ecommerce-like paths on creator_website type', () => {
    const result = filterUrl('https://janedoe.com/shop/merch', 'creator_website', null, null)
    expect(result.keep).toBe(true)
  })
})
