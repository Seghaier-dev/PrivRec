import {
  AppKey,
  Builder,
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  initSia
} from '@siafoundation/sia-storage'
import {
  saveEncryptedKey,
  loadEncryptedKey,
  hasEncryptedKey,
  clearEncryptedKey,
} from './keyStore'

// Old plaintext storage key from before we added encryption. We read it once to
// migrate it over, then delete it. New keys go through keyStore.js encrypted.
const LEGACY_APPKEY_LS = 'privrec_appkey'

const APP_META = {
  appId: 'ec398ee0b79eb7ac7dfc65795aef417ccdd3ab558d3f12f682ed191a409b9cb7',
  name: 'PrivRec',
  description: 'Privacy-preserving screen and camera recorder',
  serviceUrl: 'https://github.com/Seghaier-dev/PrivRec',
}

let sdk = null
let siaReady = false
let _pendingBuilder = null
let _pendingPhrase = null
let _approvalWaited = false
// Avoid firing two reconnect() calls at once — e.g. Upload and Play both mount
// and call it together.
let _reconnectPromise = null

// Boot the WASM module. Has to run before anything else touches the SDK.
export async function initSdk() {
  if (siaReady) return
  await initSia()
  siaReady = true
}
// Generate a fresh BIP-39 recovery phrase.
export function generateSeedPhrase() {
  return generateRecoveryPhrase()
}

// Connect with a recovery phrase. Works for both new and returning users.
// Always uses the phrase the user just typed, never a stored key, so what they
// enter wins. (Silent reconnects for returning users go through reconnect().)
// Returns { needsApproval, approvalUrl } — turning a phrase into an App Key
// needs register(), which is behind the one-time approval step.
export async function connectWithPhrase(phrase) {
  await initSdk()

  // Catch a bad phrase (wrong words / bad checksum) here instead of letting it
  // blow up later inside register().
  try {
    validateRecoveryPhrase(phrase)
  } catch {
    throw new Error('Invalid recovery phrase. Check the 12 words and try again.')
  }

  const builder = new Builder(loadIndexerUrl(), {
    ...APP_META,
    // We pass callbackUrl in case a future indexer auto-redirects after approval,
    // but we don't depend on it today: localhost can't be a redirect target, so
    // the approval flow uses a manual "I approved it — continue" button instead
    // (see Onboarding.jsx step 2). A public HTTPS deploy that wanted the auto
    // redirect would need an /auth/callback route calling completeRegistration().
    callbackUrl: window.location.origin + '/auth/callback',
  })
  await builder.requestConnection()
  const approvalUrl = builder.responseUrl()
  // The approval URL comes from a user-chosen indexer, so don't trust it blindly.
  // Only https: is accepted — the approval page handles credentials, so a
  // plain-http URL would expose them in transit even if the indexer itself is local.
  try {
    if (new URL(approvalUrl).protocol !== 'https:') throw new Error('bad scheme')
  } catch {
    throw new Error('The indexer returned an invalid approval URL. Check your indexer and try again.')
  }
  _pendingBuilder = builder
  _pendingPhrase = phrase
  return { needsApproval: true, approvalUrl }
}

// Poll the indexer until the user approves. Resolves as soon as approval shows
// up, even when the popup can't redirect back (e.g. localhost).
export async function pollApproval() {
  if (!_pendingBuilder) throw new Error('No pending connection')
  await _pendingBuilder.waitForApproval()
  _approvalWaited = true
}

// Called once the user has approved on sia.storage.
export async function completeRegistration() {
  if (!_pendingBuilder || !_pendingPhrase) {
    throw new Error('No pending connection. Please start over.')
  }
  if (!_approvalWaited) await _pendingBuilder.waitForApproval()
  try {
    sdk = await _pendingBuilder.register(_pendingPhrase)
    // JSON can't hold a Uint8Array, so store it as a plain number array and
    // rebuild it with new Uint8Array(...) on load. Encrypted before it's saved.
    await saveAppKey(Array.from(sdk.appKey().export()))
  } finally {
    // Always clear pending state so a retry can start fresh — even if saveAppKey
    // fails (e.g. IndexedDB quota exceeded) or register() throws.
    _pendingBuilder = null
    _pendingPhrase = null
    _approvalWaited = false
  }
  return sdk
}

// Reconnect quietly using the stored App Key. Safe to call from several places
// at once — they all share one in-flight promise.
export async function reconnect() {
  if (sdk) return sdk
  if (_reconnectPromise) return _reconnectPromise
  _reconnectPromise = (async () => {
    await initSdk()
    const storedKey = await loadAppKey()
    if (!storedKey) throw new Error('No App Key stored')
    const appKey = new AppKey(new Uint8Array(storedKey))
    const builder = new Builder(loadIndexerUrl(), APP_META)
    const connectedSdk = await builder.connected(appKey)
    if (!connectedSdk) throw new Error('App Key not recognized')
    sdk = connectedSdk
    return sdk
  })()
  try {
    return await _reconnectPromise
  } finally {
    _reconnectPromise = null
  }
}

export function getSdk() {
  if (!sdk) throw new Error('Not connected to Sia')
  return sdk
}

export function saveAppKey(bytes) {
  // Encrypts the seed and stores only the ciphertext (see keyStore.js).
  // It's async, so callers need to await it.
  return saveEncryptedKey(bytes)
}

export async function loadAppKey() {
  // First time around, move any old plaintext key over to encrypted storage.
  const legacy = localStorage.getItem(LEGACY_APPKEY_LS)
  if (legacy) {
    try {
      const bytes = JSON.parse(legacy)
      await saveEncryptedKey(bytes)
      localStorage.removeItem(LEGACY_APPKEY_LS)
      return bytes
    } catch {
      // Garbage legacy value — toss it and carry on.
      localStorage.removeItem(LEGACY_APPKEY_LS)
    }
  }
  return loadEncryptedKey()
}

export function hasStoredKey() {
  // Sync check: true if we have an encrypted key or a not-yet-migrated legacy
  // one. Only reads markers, never decrypts.
  return hasEncryptedKey() || !!localStorage.getItem(LEGACY_APPKEY_LS)
}

export function saveIndexerUrl(url) {
  localStorage.setItem('privrec_indexer', url)
}

export function loadIndexerUrl() {
  return localStorage.getItem('privrec_indexer') || 'https://sia.storage'
}

// Full disconnect — next time the user has to enter their phrase again.
export function hardReset() {
  sdk = null
  _pendingBuilder = null
  _pendingPhrase = null
  _approvalWaited = false
  localStorage.removeItem(LEGACY_APPKEY_LS)
  localStorage.removeItem('privrec_indexer')
  // Drops the ciphertext now and best-effort deletes the wrapping key.
  clearEncryptedKey()
}


