import { describe, it, expect, beforeEach, vi } from 'vitest'
import { consumeReturnTo } from './redirect.js'

// ---------------------------------------------------------------------------
// jsdom provides sessionStorage; we reset it between tests.
// ---------------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear()
})

describe('consumeReturnTo', () => {
  it('returns null when nothing is stored', () => {
    expect(consumeReturnTo()).toBeNull()
  })

  it('returns and removes a valid relative path', () => {
    sessionStorage.setItem('privrec_return_to', '/play?share=abc#key=xyz')
    const result = consumeReturnTo()
    expect(result).toBe('/play?share=abc#key=xyz')
    expect(sessionStorage.getItem('privrec_return_to')).toBeNull()
  })

  it('rejects an absolute https URL', () => {
    sessionStorage.setItem('privrec_return_to', 'https://evil.com/steal')
    expect(consumeReturnTo()).toBeNull()
    // Also removes the bad value so it can't be used again.
    expect(sessionStorage.getItem('privrec_return_to')).toBeNull()
  })

  it('rejects a javascript: URL', () => {
    sessionStorage.setItem('privrec_return_to', 'javascript:alert(1)')
    expect(consumeReturnTo()).toBeNull()
    expect(sessionStorage.getItem('privrec_return_to')).toBeNull()
  })

  it('rejects a protocol-relative URL', () => {
    sessionStorage.setItem('privrec_return_to', '//evil.com/steal')
    expect(consumeReturnTo()).toBeNull()
  })

  it('rejects an empty string', () => {
    sessionStorage.setItem('privrec_return_to', '')
    expect(consumeReturnTo()).toBeNull()
  })

  it('returns null when sessionStorage throws', () => {
    // Simulate a browser with sessionStorage disabled.
    const original = globalThis.sessionStorage
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked') } })
    expect(consumeReturnTo()).toBeNull()
    vi.stubGlobal('sessionStorage', original)
  })

  it('only returns the value once (removes it after reading)', () => {
    sessionStorage.setItem('privrec_return_to', '/record')
    consumeReturnTo()
    expect(consumeReturnTo()).toBeNull()
  })
})
