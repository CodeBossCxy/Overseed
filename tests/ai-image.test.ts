import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  verified: vi.fn(),
  generate: vi.fn(),
  edit: vi.fn(),
  upload: vi.fn(),
  charge: vi.fn(),
  deduct: vi.fn(),
  refund: vi.fn(),
  legacyRefund: vi.fn(),
  walletEnabled: true,
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/subscription', () => ({
  getEffectiveTier: vi.fn().mockResolvedValue('FREE'),
  isUserVerified: mocks.verified,
}))
vi.mock('@/lib/upload', () => ({ uploadFile: mocks.upload }))
vi.mock('@/lib/metering', () => ({ chargeCredits: mocks.charge }))
vi.mock('@/lib/wallet', () => ({ walletRefund: mocks.refund }))
vi.mock('@/lib/credits', () => ({ CREDIT_COSTS: { image: 2 }, deductCredits: mocks.deduct, refundDeduction: mocks.legacyRefund }))
vi.mock('@/lib/config', () => ({ get CREDIT_SYSTEM_ENABLED() { return mocks.walletEnabled } }))
vi.mock('openai', () => ({
  default: class {
    images = { generate: mocks.generate, edit: mocks.edit }
  },
  toFile: vi.fn(async (buffer, name, options) => ({ buffer, name, ...options })),
}))

import { POST } from '@/app/api/ai-image/route'

function request(body: unknown) {
  return new Request('http://localhost/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CHAT_API', 'test-key')
  mocks.walletEnabled = true
  mocks.session.mockResolvedValue({ user: { id: 'brand-1' } })
  mocks.verified.mockResolvedValue(true)
  mocks.charge.mockResolvedValue({ ok: true })
  mocks.deduct.mockResolvedValue({ ok: true })
  mocks.generate.mockResolvedValue({ data: [{ b64_json: 'aW1hZ2U=' }] })
  mocks.edit.mockResolvedValue({ data: [{ b64_json: 'aW1hZ2U=' }] })
  mocks.upload.mockResolvedValue('https://example.test/generated.png')
})

afterEach(() => vi.unstubAllEnvs())

describe('image studio generation', () => {
  it('keeps existing JSON requests working with the default settings', async () => {
    const response = await POST(request({ prompt: 'A product photograph' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: 'https://example.test/generated.png', urls: ['https://example.test/generated.png'] })
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ size: '1024x1024', quality: 'medium', n: 1 }))
    expect(mocks.edit).not.toHaveBeenCalled()
  })

  it('uses uploaded product references, selected settings, and quantity billing', async () => {
    const form = new FormData()
    Object.entries({ prompt: 'A skincare bottle', size: '1024x1536', quality: 'high', count: '2', imageType: 'detail', language: 'zh' }).forEach(([key, value]) => form.set(key, value))
    form.append('images', new File(['reference'], 'product.png', { type: 'image/png' }))
    mocks.edit.mockResolvedValue({ data: [{ b64_json: 'aW1hZ2U=' }, { b64_json: 'aW1hZ2U=' }] })
    const response = await POST(new Request('http://localhost/api/ai-image', { method: 'POST', body: form }))
    expect(response.status).toBe(200)
    expect(mocks.charge).toHaveBeenCalledWith('brand-1', 'image', expect.any(String), { quantity: 2 })
    expect(mocks.edit).toHaveBeenCalledWith(expect.objectContaining({ size: '1024x1536', quality: 'high', n: 2, image: [expect.objectContaining({ name: 'product.png', type: 'image/png' })] }))
    expect(mocks.edit.mock.calls[0][0].prompt).toContain('Chinese')
    expect(mocks.edit.mock.calls[0][0].prompt).toContain('product detail image')
    expect(mocks.generate).not.toHaveBeenCalled()
    expect((await response.json()).urls).toHaveLength(2)
  })

  it.each([{ count: 0 }, { count: 3 }, { count: 100 }, { size: '3:4' }, { quality: 'invalid' }, { prompt: '' }])('rejects invalid settings before charging: %j', async invalid => {
    const response = await POST(request({ prompt: 'A product photograph', ...invalid }))
    expect(response.status).toBe(400)
    expect(mocks.charge).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('rejects unsupported uploads before charging', async () => {
    const form = new FormData()
    form.set('prompt', 'A product photograph')
    form.append('images', new File(['not an image'], 'product.pdf', { type: 'application/pdf' }))
    expect((await POST(new Request('http://localhost/api/ai-image', { method: 'POST', body: form }))).status).toBe(400)
    expect(mocks.charge).not.toHaveBeenCalled()
  })

  it('does not generate when credits are insufficient', async () => {
    mocks.charge.mockResolvedValue({ ok: false, status: 402, body: { code: 'INSUFFICIENT_CREDITS' } })
    expect((await POST(request({ prompt: 'A product photograph' }))).status).toBe(402)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('refunds the charge if the provider returns an incomplete batch', async () => {
    expect((await POST(request({ prompt: 'A product photograph', count: 2 }))).status).toBe(502)
    expect(mocks.refund).toHaveBeenCalledWith('brand-1', mocks.charge.mock.calls[0][2])
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('charges the correct quantity and refunds upstream failures with legacy credits', async () => {
    mocks.walletEnabled = false
    mocks.generate.mockRejectedValueOnce(new Error('Provider unavailable'))
    expect((await POST(request({ prompt: 'A product photograph', count: 4 }))).status).toBe(502)
    expect(mocks.deduct).toHaveBeenCalledWith('brand-1', 'FREE', 'image', expect.any(String), 8)
    expect(mocks.legacyRefund).toHaveBeenCalledWith('brand-1', mocks.deduct.mock.calls[0][3])
  })
})
