import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Stub the Sia SDK so tests don't need the WASM binary.
// ---------------------------------------------------------------------------

let mockRequestConnection
let mockResponseUrl
let mockWaitForApproval

vi.mock('@siafoundation/sia-storage', () => {
  mockRequestConnection = vi.fn(async () => {})
  mockResponseUrl = vi.fn(() => 'https://sia.storage/approve?token=abc')
  mockWaitForApproval = vi.fn(async () => {})

  class Builder {
    constructor(_url, _meta) {}
    requestConnection = mockRequestConnection
    responseUrl = mockResponseUrl
    waitForApproval = mockWaitForApproval
  }

  return {
    AppKey: class { constructor(_bytes) {} },
    Builder,
    generateRecoveryPhrase: () => 'word '.repeat(12).trim(),
    validateRecoveryPhrase: vi.fn(),
    initSia: vi.fn(async () => {}),
  }
})

// Stub keyStore so tests don't need IndexedDB.
vi.mock('./keyStore.js', () => ({
  saveEncryptedKey: vi.fn(async () => {}),
  loadEncryptedKey: vi.fn(async () => null),
  hasEncryptedKey: vi.fn(() => false),
  clearEncryptedKey: vi.fn(),
}))

// Stub localStorage.
const lsMap = {}
vi.stubGlobal('localStorage', {
  getItem: k => lsMap[k] ?? null,
  setItem: (k, v) => { lsMap[k] = v },
  removeItem: k => { delete lsMap[k] },
})

// ---------------------------------------------------------------------------
// Tests: approval URL scheme validation (SEC-07)
// ---------------------------------------------------------------------------

describe('connectWithPhrase — approval URL validation', () => {
  beforeEach(async () => {
    vi.resetModules()
    // Reset mock factories after resetModules.
    const sdk = await import('@siafoundation/sia-storage')
    mockRequestConnection = sdk.Builder.prototype?.requestConnection ?? vi.fn(async () => {})
    mockWaitForApproval = sdk.Builder.prototype?.waitForApproval ?? vi.fn(async () => {})
  })

  it('accepts an https approval URL', async () => {
    const { connectWithPhrase, initSdk } = await import('./sia.js')
    await initSdk()
    // Default mock returns https:// URL — should succeed.
    const result = await connectWithPhrase('word '.repeat(12).trim())
    expect(result.needsApproval).toBe(true)
    expect(result.approvalUrl).toMatch(/^https:\/\//)
  })

  it('rejects an http approval URL from the indexer', async () => {
    vi.resetModules()
    // Make the Builder return an http:// URL.
    vi.doMock('@siafoundation/sia-storage', () => ({
      AppKey: class {},
      Builder: class {
        requestConnection = vi.fn(async () => {})
        responseUrl = vi.fn(() => 'http://sia.storage/approve?token=abc')
        waitForApproval = vi.fn(async () => {})
      },
      generateRecoveryPhrase: () => 'word '.repeat(12).trim(),
      validateRecoveryPhrase: vi.fn(),
      initSia: vi.fn(async () => {}),
    }))
    vi.doMock('./keyStore.js', () => ({
      saveEncryptedKey: vi.fn(async () => {}),
      loadEncryptedKey: vi.fn(async () => null),
      hasEncryptedKey: vi.fn(() => false),
      clearEncryptedKey: vi.fn(),
    }))
    const { connectWithPhrase, initSdk } = await import('./sia.js')
    await initSdk()
    await expect(connectWithPhrase('word '.repeat(12).trim()))
      .rejects.toThrow('invalid approval URL')
  })

  it('rejects a javascript: approval URL from the indexer', async () => {
    vi.resetModules()
    vi.doMock('@siafoundation/sia-storage', () => ({
      AppKey: class {},
      Builder: class {
        requestConnection = vi.fn(async () => {})
        responseUrl = vi.fn(() => 'javascript:alert(1)')
        waitForApproval = vi.fn(async () => {})
      },
      generateRecoveryPhrase: () => 'word '.repeat(12).trim(),
      validateRecoveryPhrase: vi.fn(),
      initSia: vi.fn(async () => {}),
    }))
    vi.doMock('./keyStore.js', () => ({
      saveEncryptedKey: vi.fn(async () => {}),
      loadEncryptedKey: vi.fn(async () => null),
      hasEncryptedKey: vi.fn(() => false),
      clearEncryptedKey: vi.fn(),
    }))
    const { connectWithPhrase, initSdk } = await import('./sia.js')
    await initSdk()
    await expect(connectWithPhrase('word '.repeat(12).trim()))
      .rejects.toThrow('invalid approval URL')
  })

  it('rejects a data: approval URL from the indexer', async () => {
    vi.resetModules()
    vi.doMock('@siafoundation/sia-storage', () => ({
      AppKey: class {},
      Builder: class {
        requestConnection = vi.fn(async () => {})
        responseUrl = vi.fn(() => 'data:text/html,<script>alert(1)</script>')
        waitForApproval = vi.fn(async () => {})
      },
      generateRecoveryPhrase: () => 'word '.repeat(12).trim(),
      validateRecoveryPhrase: vi.fn(),
      initSia: vi.fn(async () => {}),
    }))
    vi.doMock('./keyStore.js', () => ({
      saveEncryptedKey: vi.fn(async () => {}),
      loadEncryptedKey: vi.fn(async () => null),
      hasEncryptedKey: vi.fn(() => false),
      clearEncryptedKey: vi.fn(),
    }))
    const { connectWithPhrase, initSdk } = await import('./sia.js')
    await initSdk()
    await expect(connectWithPhrase('word '.repeat(12).trim()))
      .rejects.toThrow('invalid approval URL')
  })
})
