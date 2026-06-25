// Encrypted storage for the App Key seed.
//
// The seed is the private key for the user's Sia account, so we don't want it
// sitting in localStorage as plaintext where any script (XSS, a bad dependency)
// could grab it.
//
// The trick: generate an AES-GCM key that's marked non-extractable and keep it
// in IndexedDB. Non-extractable means JS can never read the raw key bytes — not
// us, not an attacker — it can only use it to encrypt/decrypt. We encrypt the
// seed with it and store just the ciphertext.
//
// So a stolen localStorage dump or disk backup only gives up ciphertext. It
// doesn't stop code already running on the page from calling decrypt, so we
// still ship a strict CSP alongside this.

const DB_NAME = 'privrec'
const STORE = 'keys'
const WRAP_KEY_ID = 'appkey-wrap'
const CIPHERTEXT_LS_KEY = 'privrec_appkey_enc'

// Cached DB connection — opened once and reused for all subsequent operations.
let _dbPromise = null

function openDb() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { _dbPromise = null; reject(req.error) }
  })
  return _dbPromise
}

// Keep the wrapping key handle in memory so we don't hit IndexedDB on every
// call and so concurrent get-or-create calls don't race.
let _wrapKeyPromise = null

function idbGet(key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
  )
}

function idbSet(key, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
  )
}

function idbDelete(key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
  )
}

// Grab the existing wrapping key, or make a new one the first time.
function getWrapKey() {
  if (_wrapKeyPromise) return _wrapKeyPromise
  _wrapKeyPromise = (async () => {
    const existing = await idbGet(WRAP_KEY_ID)
    if (existing) return existing
    // false = non-extractable, the whole point here.
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
    await idbSet(WRAP_KEY_ID, key)
    return key
  })()
  // Don't cache a failure forever — let the next call retry.
  _wrapKeyPromise.catch(() => {
    _wrapKeyPromise = null
  })
  return _wrapKeyPromise
}

function bytesToB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64ToBytes(b64) {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

// Encrypt and save the seed (number array or Uint8Array).
export async function saveEncryptedKey(bytes) {
  const key = await getWrapKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new Uint8Array(bytes)
  )
  const payload = { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) }
  localStorage.setItem(CIPHERTEXT_LS_KEY, JSON.stringify(payload))
}

// Decrypt and return the seed as a number array, or null if there's nothing saved.
export async function loadEncryptedKey() {
  const raw = localStorage.getItem(CIPHERTEXT_LS_KEY)
  if (!raw) return null
  let payload
  try { payload = JSON.parse(raw) } catch { payload = null }
  if (!payload || typeof payload.iv !== 'string' || typeof payload.ct !== 'string') {
    // Corrupt or tampered entry — treat as missing rather than crashing.
    localStorage.removeItem(CIPHERTEXT_LS_KEY)
    return null
  }
  const key = await getWrapKey()
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.ct)
  )
  return Array.from(new Uint8Array(pt))
}

// Quick existence check — just looks at the localStorage marker, no decrypt.
export function hasEncryptedKey() {
  return !!localStorage.getItem(CIPHERTEXT_LS_KEY)
}

// Wipe the ciphertext now and best-effort drop the wrapping key from IndexedDB.
export function clearEncryptedKey() {
  localStorage.removeItem(CIPHERTEXT_LS_KEY)
  _wrapKeyPromise = null
  idbDelete(WRAP_KEY_ID).catch(() => {})
}
