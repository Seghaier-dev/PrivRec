import { describe, it, expect, vi } from 'vitest'
import { listRecordings, parseRecordingMetadata, formatBytes } from './recordings'

// ---------------------------------------------------------------------------
// Test doubles — a minimal PinnedObject-ish handle and an sdk with an event log.
// ---------------------------------------------------------------------------

function fakeObject(meta, { createdAt = new Date('2026-01-01'), size = 123 } = {}) {
  return {
    metadata: () => new TextEncoder().encode(meta === undefined ? '' : JSON.stringify(meta)),
    createdAt: () => createdAt,
    size: () => size,
  }
}

// Builds an sdk whose objectEvents() serves `events` in pages, respecting the
// limit argument like the real indexer does.
function fakeSdk(events) {
  return {
    objectEvents: vi.fn(async (cursor, limit) => {
      // Cursor is { id, after } of the last event seen; find where to resume.
      let start = 0
      if (cursor) {
        const idx = events.findIndex(e => e.id === cursor.id && e.updatedAt === cursor.after)
        start = idx === -1 ? events.length : idx + 1
      }
      return events.slice(start, start + limit)
    }),
  }
}

// ---------------------------------------------------------------------------
// parseRecordingMetadata
// ---------------------------------------------------------------------------

describe('parseRecordingMetadata', () => {
  it('decodes the JSON metadata written at upload time', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ name: 'Demo', size: 5 }))
    expect(parseRecordingMetadata(bytes)).toEqual({ name: 'Demo', size: 5 })
  })

  it('returns {} for empty bytes', () => {
    expect(parseRecordingMetadata(new Uint8Array())).toEqual({})
  })

  it('returns {} for non-JSON bytes', () => {
    expect(parseRecordingMetadata(new TextEncoder().encode('not json'))).toEqual({})
  })

  it('returns {} for JSON that is not an object', () => {
    expect(parseRecordingMetadata(new TextEncoder().encode('[1,2]'))).toEqual({})
    expect(parseRecordingMetadata(new TextEncoder().encode('"str"'))).toEqual({})
    expect(parseRecordingMetadata(new TextEncoder().encode('null'))).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// listRecordings — replaying the event log
// ---------------------------------------------------------------------------

describe('listRecordings', () => {
  it('returns live recordings with metadata applied, newest first', async () => {
    const sdk = fakeSdk([
      {
        id: 'a', deleted: false, updatedAt: new Date('2026-01-01'),
        object: fakeObject({ name: 'First', date: '2026-01-01T00:00:00Z', size: 10, mime: 'video/webm' }),
      },
      {
        id: 'b', deleted: false, updatedAt: new Date('2026-02-01'),
        object: fakeObject({ name: 'Second', date: '2026-02-01T00:00:00Z', size: 20 }),
      },
    ])
    const recs = await listRecordings(sdk)
    expect(recs.map(r => r.name)).toEqual(['Second', 'First'])
    expect(recs[1]).toMatchObject({ id: 'a', size: 10, mime: 'video/webm' })
  })

  it('drops recordings that were later deleted', async () => {
    const sdk = fakeSdk([
      { id: 'a', deleted: false, updatedAt: new Date('2026-01-01'), object: fakeObject({ name: 'Keep' }) },
      { id: 'b', deleted: false, updatedAt: new Date('2026-01-02'), object: fakeObject({ name: 'Gone' }) },
      { id: 'b', deleted: true,  updatedAt: new Date('2026-01-03'), object: undefined },
    ])
    const recs = await listRecordings(sdk)
    expect(recs).toHaveLength(1)
    expect(recs[0].id).toBe('a')
  })

  it('later events for the same id win (metadata updates)', async () => {
    const sdk = fakeSdk([
      { id: 'a', deleted: false, updatedAt: new Date('2026-01-01'), object: fakeObject({ name: 'Old name' }) },
      { id: 'a', deleted: false, updatedAt: new Date('2026-01-02'), object: fakeObject({ name: 'New name' }) },
    ])
    const recs = await listRecordings(sdk)
    expect(recs).toHaveLength(1)
    expect(recs[0].name).toBe('New name')
  })

  it('pages through more events than one call returns', async () => {
    const events = Array.from({ length: 150 }, (_, i) => ({
      id: `id${i}`,
      deleted: false,
      updatedAt: new Date(2026, 0, 1, 0, 0, i),
      object: fakeObject({ name: `Rec ${i}`, date: new Date(2026, 0, 1, 0, 0, i).toISOString() }),
    }))
    const sdk = fakeSdk(events)
    const recs = await listRecordings(sdk)
    expect(recs).toHaveLength(150)
    expect(sdk.objectEvents.mock.calls.length).toBeGreaterThan(1)
  })

  it('falls back to object fields when metadata is missing', async () => {
    const created = new Date('2026-03-01')
    const sdk = fakeSdk([
      { id: 'a', deleted: false, updatedAt: created, object: fakeObject(undefined, { createdAt: created, size: 42 }) },
    ])
    const recs = await listRecordings(sdk)
    expect(recs[0]).toMatchObject({
      name: 'Untitled recording',
      size: 42,
      mime: 'video/webm',
    })
    expect(recs[0].date).toEqual(created)
  })

  it('returns [] for an empty event log', async () => {
    const recs = await listRecordings(fakeSdk([]))
    expect(recs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB')
  })

  it('handles garbage input', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(NaN)).toBe('—')
    expect(formatBytes(Infinity)).toBe('—')
  })
})
