import { describe, it, expect } from 'vitest'
import { buildPlayUrl, parseShareUrl } from './shareLink.js'

const ORIGIN = 'https://privrec.app'

describe('buildPlayUrl', () => {
  it('encodes the base into the share param', () => {
    const url = buildPlayUrl('https://sia.storage/objects/abc/shared?token=xyz', ORIGIN)
    expect(url).toBe(
      ORIGIN + '/play?share=' + encodeURIComponent('https://sia.storage/objects/abc/shared?token=xyz')
    )
  })

  it('keeps the fragment as a real fragment, not encoded', () => {
    const url = buildPlayUrl('https://sia.storage/objects/abc/shared?token=xyz#secret=123', ORIGIN)
    expect(url).toContain('#secret=123')
    // The fragment must not be percent-encoded into the share param.
    expect(url).not.toContain(encodeURIComponent('#secret=123'))
  })

  it('handles a share URL with no fragment', () => {
    const url = buildPlayUrl('https://sia.storage/objects/abc/shared', ORIGIN)
    expect(url).toBe(ORIGIN + '/play?share=' + encodeURIComponent('https://sia.storage/objects/abc/shared'))
  })
})

describe('parseShareUrl', () => {
  it('returns empty string when there is no share param', () => {
    expect(parseShareUrl('?foo=bar', '')).toBe('')
    expect(parseShareUrl('', '')).toBe('')
  })

  it('reassembles base and fragment', () => {
    const base = 'https://sia.storage/objects/abc/shared?token=xyz'
    const search = '?share=' + encodeURIComponent(base)
    expect(parseShareUrl(search, '#secret=123')).toBe(base + '#secret=123')
  })
})

describe('buildPlayUrl <-> parseShareUrl round-trip', () => {
  const cases = [
    'https://sia.storage/objects/abc/shared?token=xyz#secret=123',
    'https://sia.storage/objects/abc/shared?token=xyz',
    'https://sia.storage/objects/abc/shared',
    'https://sia.storage/objects/abc/shared?a=1&b=2#k=v&w=z',
  ]

  for (const original of cases) {
    it(`survives a round-trip: ${original}`, () => {
      const playUrl = buildPlayUrl(original, ORIGIN)
      // Split the built /play URL back into search + hash, like the browser would.
      const hashIndex = playUrl.indexOf('#')
      const search = (hashIndex === -1 ? playUrl : playUrl.slice(0, hashIndex)).slice(
        playUrl.indexOf('/play?') + '/play'.length
      )
      const hash = hashIndex === -1 ? '' : playUrl.slice(hashIndex)
      expect(parseShareUrl(search, hash)).toBe(original)
    })
  }
})
