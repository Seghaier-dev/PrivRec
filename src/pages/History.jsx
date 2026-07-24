import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSdk, reconnect } from '../lib/sia'
import { listRecordings, formatBytes } from '../lib/recordings'
import { buildPlayUrl } from '../lib/shareLink'

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
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{rec.name}</p>
          <p className="text-xs text-gray-400">
            {rec.date.toLocaleString()} · {formatBytes(rec.size)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setExpanded(e => !e); setConfirmingDelete(false) }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            {expanded ? 'Close' : shareUrl ? 'Share ✓' : 'Share'}
          </button>
          {confirmingDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Link expires after:</span>
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setExpiry(opt)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  expiry.label === opt.label
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={generateLink}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            {shareUrl ? 'Regenerate link' : 'Create share link'}
          </button>
          {shareUrl && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-mono text-gray-700 break-all">
                {buildPlayUrl(shareUrl)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy link'}
                </button>
                <button
                  onClick={() => window.open(buildPlayUrl(shareUrl), '_blank', 'noopener')}
                  className="flex-1 py-2 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors"
                >
                  Watch →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-medium mt-1">{value}</p>
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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-lg font-semibold tracking-tight">PrivRec</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/account')}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            Account stats
          </button>
          <button
            onClick={() => navigate('/record')}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            ← Back to recorder
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-medium">My recordings</h1>

        {status === 'loading' && (
          <p className="text-sm text-gray-400">Loading your recordings...</p>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Account stats from the Sia account API */}
            {account && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Recordings" value={recordings.length} />
                <StatCard label="Stored" value={formatBytes(account.pinnedData)} />
                <StatCard label="Remaining" value={formatBytes(account.remainingStorage)} />
                <StatCard label="Quota" value={formatBytes(account.maxPinnedData)} />
              </div>
            )}

            {recordings.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-gray-400">No recordings yet.</p>
                <button
                  onClick={() => navigate('/record')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
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
