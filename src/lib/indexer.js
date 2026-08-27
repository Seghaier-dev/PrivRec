// Validation for user-entered indexer URLs, shared by Onboarding and Settings.
//
// HTTPS only — the indexer approval page handles credentials, so plain HTTP
// would expose them in transit. The one exception is localhost, so you can
// point the app at an indexd instance running on your own machine.
export function validateIndexerUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return 'Invalid indexer URL. Please enter a valid URL.'
  }
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    return 'Indexer URL must use HTTPS.'
  }
  return null
}
