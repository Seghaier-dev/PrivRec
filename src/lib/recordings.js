// Recording-history helpers built on the Sia SDK.
//
// The indexer doesn't have a "list objects" call — it has an *event log*
// (sdk.objectEvents). Every create / metadata-update / delete shows up as an
// event, in order. To get the current set of recordings we replay the whole
// log: later events for the same id win, and a delete event removes the id.
// That's what listRecordings() does, a page at a time.

const PAGE_SIZE = 100

// Decode the metadata bytes we wrote at upload time (see Upload.jsx).
// Anything unexpected — empty, not JSON, not an object — comes back as {}
// so callers can rely on plain property access.
export function parseRecordingMetadata(bytes) {
  try {
    const meta = JSON.parse(new TextDecoder().decode(bytes))
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
  } catch {
    return {}
  }
}

// Replay the indexer's event log into the list of live recordings,
// newest first. Each entry keeps the PinnedObject handle so callers can
// share/download/delete without another round-trip.
export async function listRecordings(sdk) {
  const alive = new Map()
  let cursor = null

  for (;;) {
    const events = await sdk.objectEvents(cursor, PAGE_SIZE)
    if (!events.length) break
    for (const ev of events) {
      if (ev.deleted) {
        alive.delete(ev.id)
      } else if (ev.object) {
        alive.set(ev.id, ev.object)
      }
      cursor = { id: ev.id, after: ev.updatedAt }
    }
    if (events.length < PAGE_SIZE) break
  }

  const recordings = []
  for (const [id, object] of alive) {
    const meta = parseRecordingMetadata(object.metadata())
    recordings.push({
      id,
      object,
      name: typeof meta.name === 'string' && meta.name ? meta.name : 'Untitled recording',
      date: meta.date ? new Date(meta.date) : object.createdAt(),
      size: typeof meta.size === 'number' ? meta.size : object.size(),
      mime: typeof meta.mime === 'string' ? meta.mime : 'video/webm',
    })
  }
  recordings.sort((a, b) => b.date - a.date)
  return recordings
}

// "1.2 GB" style formatting for the stats cards.
export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '-'
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log2(n) / 10), units.length - 1)
  const value = n / 2 ** (10 * i)
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}
