import { describe, it, expect } from 'vitest'
import { validateIndexerUrl } from './indexer'

describe('validateIndexerUrl', () => {
  it('accepts an https URL', () => {
    expect(validateIndexerUrl('https://sia.storage')).toBeNull()
    expect(validateIndexerUrl('https://indexd.example.com:9980')).toBeNull()
  })

  it('accepts plain http only for localhost', () => {
    expect(validateIndexerUrl('http://localhost:9980')).toBeNull()
    expect(validateIndexerUrl('http://127.0.0.1:9980')).toBeNull()
    expect(validateIndexerUrl('http://[::1]:9980')).toBeNull()
  })

  it('rejects plain http for non-local hosts', () => {
    expect(validateIndexerUrl('http://sia.storage')).toBe('Indexer URL must use HTTPS.')
    // Subdomain look-alikes are not localhost.
    expect(validateIndexerUrl('http://localhost.evil.com')).toBe('Indexer URL must use HTTPS.')
  })

  it('rejects other schemes', () => {
    expect(validateIndexerUrl('ftp://sia.storage')).toBe('Indexer URL must use HTTPS.')
    expect(validateIndexerUrl('javascript:alert(1)')).toBe('Indexer URL must use HTTPS.')
  })

  it('rejects strings that are not URLs', () => {
    expect(validateIndexerUrl('not a url')).toBe('Invalid indexer URL. Please enter a valid URL.')
    expect(validateIndexerUrl('')).toBe('Invalid indexer URL. Please enter a valid URL.')
  })
})
