import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Minimal browser API stubs
// ---------------------------------------------------------------------------

// AES-GCM stub: xors each byte with 0xAA (invertible). The "IV" is just the
// 12 zero-filled bytes from our getRandomValues stub, prepended to the
// ciphertext so decrypt can strip it.
const subtleStub = {
  generateKey: vi.fn(async () => ({ _stubKey: true })),
  encrypt: vi.fn(async ({ iv }, _key, data) => {
    const plain = new Uint8Array(data)
    const ct = plain.map(b => b ^ 0xaa)
    // prefix with iv so decrypt knows where ct starts
    const out = new Uint8Array(iv.length + ct.length)
    out.set(iv)
    out.set(ct, iv.length)
    return out.buffer
  }),
  decrypt: vi.fn(async ({ iv }, _key, data) => {
    const bytes = new Uint8Array(data)
    const ct = bytes.slice(iv.length)
    return ct.map(b => b ^ 0xaa).buffer
  }),
}

vi.stubGlobal('crypto', {
  getRandomValues: vi.fn(arr => { arr.fill(0x42); return arr }),
  subtle: subtleStub,
})

// In-memory IndexedDB that fires callbacks via microtasks AFTER the caller
// has had a chance to set the handler properties.
function makeIdbStub() {
  const store = {}

  const dbObj = {
    transaction: (_name, _mode) => {
      const tx = {
        objectStore: () => ({
          get: key => {
            const req = { result: store[key] }
            // Microtask fires after the caller sets req.onsuccess.
            Promise.resolve().then(() => { if (req.onsuccess) req.onsuccess() })
            return req
          },
          put: (value, key) => { store[key] = value },
          delete: key => { delete store[key] },
        }),
        // Setter fires oncomplete as a microtask so the caller's handler is set first.
        set oncomplete(fn) {
          Promise.resolve().then(() => { if (fn) fn() })
        },
        onerror: null,
      }
      return tx
    },
  }

  // Return a fresh indexedDB stub whose open() schedules onsuccess on call.
  return {
    indexedDB: {
      open: () => {
        const req = { result: dbObj }
        // Microtask fires AFTER the caller (openDb) assigns req.onsuccess.
        Promise.resolve().then(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
    },
    _store: store,
  }
}

// ---------------------------------------------------------------------------
// Per-test setup: fresh stubs + fresh module import
// ---------------------------------------------------------------------------

let keyStore

beforeEach(async () => {
  const idb = makeIdbStub()
  vi.stubGlobal('indexedDB', idb.indexedDB)

  const lsMap = {}
  vi.stubGlobal('localStorage', {
    getItem: k => lsMap[k] ?? null,
    setItem: (k, v) => { lsMap[k] = String(v) },
    removeItem: k => { delete lsMap[k] },
  })

  vi.resetModules()
  keyStore = await import('./keyStore.js')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('keyStore', () => {
  it('returns null when nothing is stored', async () => {
    expect(await keyStore.loadEncryptedKey()).toBeNull()
  })

  it('hasEncryptedKey() is false before saving', () => {
    expect(keyStore.hasEncryptedKey()).toBe(false)
  })

  it('round-trips a key through encrypt → save → load → decrypt', async () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8]
    await keyStore.saveEncryptedKey(original)
    const loaded = await keyStore.loadEncryptedKey()
    expect(loaded).toEqual(original)
  })

  it('hasEncryptedKey() is true after saving', async () => {
    await keyStore.saveEncryptedKey([10, 20, 30])
    expect(keyStore.hasEncryptedKey()).toBe(true)
  })

  it('returns null and clears corrupt JSON payload', async () => {
    localStorage.setItem('privrec_appkey_enc', 'not-valid-json{{')
    expect(await keyStore.loadEncryptedKey()).toBeNull()
    expect(localStorage.getItem('privrec_appkey_enc')).toBeNull()
  })

  it('returns null for a payload missing iv field', async () => {
    localStorage.setItem('privrec_appkey_enc', JSON.stringify({ ct: 'abc' }))
    expect(await keyStore.loadEncryptedKey()).toBeNull()
  })

  it('returns null for a payload missing ct field', async () => {
    localStorage.setItem('privrec_appkey_enc', JSON.stringify({ iv: 'abc' }))
    expect(await keyStore.loadEncryptedKey()).toBeNull()
  })

  it('returns null for a null JSON payload', async () => {
    localStorage.setItem('privrec_appkey_enc', 'null')
    expect(await keyStore.loadEncryptedKey()).toBeNull()
  })

  it('clearEncryptedKey removes the stored ciphertext', async () => {
    await keyStore.saveEncryptedKey([1, 2, 3])
    expect(keyStore.hasEncryptedKey()).toBe(true)
    keyStore.clearEncryptedKey()
    expect(keyStore.hasEncryptedKey()).toBe(false)
    expect(await keyStore.loadEncryptedKey()).toBeNull()
  })
})
