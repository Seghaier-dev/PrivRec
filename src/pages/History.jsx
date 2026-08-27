import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSdk, reconnect } from '../lib/sia'
import { listRecordings, formatBytes } from '../lib/recordings'
import { buildPlayUrl } from '../lib/shareLink'
import AppHeader from '../components/AppHeader'
import { IconVideo, IconCopy, IconCheck, IconExternal, IconTrash, IconLink } from '../components/icons'

const EXPIRY_OPTIONS = [
  { label: '1 hour',   ms: 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days',   ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 days',  ms: 30 * 24 * 60 * 60 * 1000 },
  { label: 'Never',    ms: 100 * 365 * 24 * 60 * 60 * 1000 },
]

// One recording row: name/date/size plus the share and delete flows.
// Sharing always mints a *new* link — shareObject() signs a fresh URL each
// time — so this doubles as "regenerate a link for an old recording".
function RecordingRow({ rec, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[2])
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const copyTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  function generateLink() {
    setError('')
    try {
      const sdk = getSdk()
      const expires = new Date(Date.now() + expiry.ms)
      setShareUrl(sdk.shareObject(rec.object, expires))
    } catch (e) {
      setError(e.message)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(buildPlayUrl(shareUrl))
      setCopied(true)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard. Please copy the link manually.')
    }
  }

  async function handleDelete() {
    setError('')
    setDeleting(true)
    try {
      await getSdk().deleteObject(rec.id)
      onDelete(rec.id)
    } catch (e) {
      setError(e.message)
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-gray-300">
            <IconVideo size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{rec.name}</p>
            <p className="text-xs text-gray-400">
              {rec.date.toLocaleString()} · {formatBytes(rec.size)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => { setExpanded(e => !e); setConfirmingDelete(false) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              expanded
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {expanded ? 'Close' : 'Share'}
          </button>
          {confirmingDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete recording"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-gray-500">Expires after</span>
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setExpiry(opt)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  expiry.label === opt.label
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={generateLink}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800"
          >
            <IconLink size={13} />
            {shareUrl ? 'Regenerate link' : 'Create share link'}
          </button>
          {shareUrl && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="break-all font-mono text-xs leading-relaxed text-gray-700">
                {buildPlayUrl(shareUrl)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800"
                >
                  {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  onClick={() => window.open(buildPlayUrl(shareUrl), '_blank', 'noopener,noreferrer')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <IconExternal size={13} />
                  Watch
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
    </div>
  )
}

export default function History() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [recordings, setRecordings] = useState([])
  const [account, setAccount] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reconnect()
        const sdk = getSdk()
        // Stats and history are independent — fetch them together.
        const [acct, recs] = await Promise.all([
          sdk.account().catch(() => null), // stats are nice-to-have, not fatal
          listRecordings(sdk),
        ])
        if (cancelled) return
        setAccount(acct)
        setRecordings(recs)
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setError(e.message)
        setStatus('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleDeleted(id) {
    setRecordings(prev => prev.filter(r => r.id !== id))
    // Deleting frees pinned storage; refresh the stats quietly.
    getSdk().account().then(setAccount).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Library</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              All your encrypted recordings, in one place.
            </p>
          </div>
          <button
            onClick={() => navigate('/record')}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
          >
            New recording
          </button>
        </div>

        {status === 'loading' && (
          <p className="text-sm text-gray-400">Loading your recordings...</p>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Account stats from the Sia account API */}
            {account && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">Storage</p>
                  {account.maxPinnedData > 0 && (
                    <p className="text-xs tabular-nums text-gray-400">
                      {Math.min(100, Math.round((account.pinnedData / account.maxPinnedData) * 100))}% of quota used
                    </p>
                  )}
                </div>
                {account.maxPinnedData > 0 && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gray-900 transition-all"
                      style={{
                        width:
                          Math.min(100, Math.round((account.pinnedData / account.maxPinnedData) * 100)) + '%',
                      }}
                    />
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
                  <Stat label="Recordings" value={recordings.length} />
                  <Stat label="Stored" value={formatBytes(account.pinnedData)} />
                  <Stat label="Remaining" value={formatBytes(account.remainingStorage)} />
                  <Stat label="Quota" value={formatBytes(account.maxPinnedData)} />
                </div>
              </div>
            )}

            {recordings.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <IconVideo size={20} />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">No recordings yet</p>
                  <p className="text-sm text-gray-400">Your uploads will show up here.</p>
                </div>
                <button
                  onClick={() => navigate('/record')}
                  className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  Make your first recording
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map(rec => (
                  <RecordingRow key={rec.id} rec={rec} onDelete={handleDeleted} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
