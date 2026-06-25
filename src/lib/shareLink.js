// Helpers for turning a Sia share URL into a /play link and back again.
//
// A Sia share URL can carry its decryption secret in the URL *fragment* (#...),
// which browsers never send to a server. We keep that fragment intact end-to-end:
// the object base + query string goes into the ?share= query param, and the
// fragment stays a fragment. Upload builds the link with buildPlayUrl(); Play
// reads it back with parseShareUrl(). Keeping both sides in one file means the
// round-trip can't silently drift apart.

// Build the shareable /play URL from a raw Sia share URL.
export function buildPlayUrl(shareUrl, origin = window.location.origin) {
  const hashIndex = shareUrl.indexOf('#')
  const base = hashIndex === -1 ? shareUrl : shareUrl.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? '' : shareUrl.slice(hashIndex)
  return origin + '/play?share=' + encodeURIComponent(base) + fragment
}

// Reverse of buildPlayUrl: reassemble the original Sia share URL from a /play
// location's search string and hash. Returns '' when there's no share param.
export function parseShareUrl(search, hash) {
  const params = new URLSearchParams(search)
  const base = params.get('share')
  if (!base) return ''
  return hash ? base + hash : base
}
