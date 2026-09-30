import { describe, it, expect } from 'vitest'
import { classifyUrl } from '../src/classifier.js'

describe('classifyUrl', () => {
  it('classifies instagram.com/username as instagram_profile', () => {
    const result = classifyUrl('https://instagram.com/beautyqueen')
    expect(result.urlType).toBe('instagram_profile')
    expect(result.platform).toBe('instagram')
    expect(result.extractedHandle).toBe('beautyqueen')
    expect(result.confidence).toBe(1)
  })

  it('classifies tiktok.com/@username as tiktok_profile', () => {
    const result = classifyUrl('https://tiktok.com/@fitnessguru')
    expect(result.urlType).toBe('tiktok_profile')
    expect(result.platform).toBe('tiktok')
    expect(result.extractedHandle).toBe('@fitnessguru')
    expect(result.confidence).toBe(1)
  })

  it('classifies youtube.com/@username as youtube_channel', () => {
    const result = classifyUrl('https://youtube.com/@mychannel')
    expect(result.urlType).toBe('youtube_channel')
    expect(result.platform).toBe('youtube')
    expect(result.extractedHandle).toBe('@mychannel')
    expect(result.confidence).toBe(1)
  })

  it('classifies youtube.com/channel/UCXXX as youtube_channel', () => {
    const result = classifyUrl('https://youtube.com/channel/UCxxABCDEF')
    expect(result.urlType).toBe('youtube_channel')
    expect(result.platform).toBe('youtube')
    expect(result.extractedHandle).toBe('UCxxABCDEF')
    expect(result.confidence).toBe(1)
  })

  it('classifies linktr.ee/username as link_in_bio', () => {
    const result = classifyUrl('https://linktr.ee/somehandle')
    expect(result.urlType).toBe('link_in_bio')
    expect(result.extractedHandle).toBe('somehandle')
  })

  it('classifies hypeauditor.com as agency_or_directory', () => {
    const result = classifyUrl('https://hypeauditor.com/instagram/someuser')
    expect(result.urlType).toBe('agency_or_directory')
    expect(result.confidence).toBe(1)
  })

  it('does NOT classify instagram.com/explore as profile', () => {
    const result = classifyUrl('https://instagram.com/explore')
    expect(result.urlType).toBe('unknown')
  })

  it('does NOT classify tiktok.com/discover as profile', () => {
    const result = classifyUrl('https://tiktok.com/discover')
    expect(result.urlType).toBe('unknown')
  })

  it('does NOT classify youtube.com/results as channel', () => {
    const result = classifyUrl('https://youtube.com/results?search_query=beauty')
    expect(result.urlType).toBe('unknown')
  })

  it('classifies unknown domain as unknown when no title hints', () => {
    const result = classifyUrl('https://somerandomblog.com/post/1')
    expect(result.urlType).toBe('unknown')
  })

  it('classifies unknown domain as creator_website with creator title hint', () => {
    const result = classifyUrl('https://somerandomblog.com', 'Jane Doe — Beauty Influencer', null)
    expect(result.urlType).toBe('creator_website')
    expect(result.confidence).toBe(0.5)
  })

  it('classifies unknown domain as creator_website with creator description hint', () => {
    const result = classifyUrl('https://janedoe.com', null, 'I am a content creator based in NYC')
    expect(result.urlType).toBe('creator_website')
  })

  it('extracts handle for tiktok without @ in URL', () => {
    const result = classifyUrl('https://tiktok.com/beautyqueen')
    expect(result.urlType).toBe('tiktok_profile')
    expect(result.extractedHandle).toBe('@beautyqueen')
  })

  it('extracts handle for youtube /c/name', () => {
    const result = classifyUrl('https://youtube.com/c/MyCoolChannel')
    expect(result.urlType).toBe('youtube_channel')
    expect(result.extractedHandle).toBe('MyCoolChannel'.toLowerCase())
    expect(result.confidence).toBe(0.9)
  })

  it('classifies article paths as article', () => {
    const result = classifyUrl('https://someblog.com/blog/top-10-beauty-creators')
    expect(result.urlType).toBe('article')
  })
})
