import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSdk, reconnect } from '../lib/sia'
import { PinnedObject, encodedSize } from '@siafoundation/sia-storage'
import { buildPlayUrl } from '../lib/shareLink'
import AppHeader from '../components/AppHeader'
import { IconCopy, IconCheck, IconExternal, IconLink, IconLock } from '../components/icons'

const EXPIRY_OPTIONS = [
  { label: '1 hour',   ms: 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days',   ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 days',  ms: 30 * 24 * 60 * 60 * 1000 },
  // "Never" isn't really never — shareObject needs a real date, so we just
  // push it 100 years out.
  { label: 'Never',    ms: 100 * 365 * 24 * 60 * 60 * 1000 },
]

export default function Upload() {
  const navigate = useNavigate()
  const location = useLocation()
  const blob = location.state?.blob

  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[2]) // default 7 days
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [uploadPct, setUploadPct] = useState(0)
  const [shareUrl, setShareUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef(null)

  useEffect(() => {
    if (!blob) navigate('/record')
  }, [blob, navigate])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!uploading) return
    function handleBeforeUnload(e) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [uploading])

  async function handleUpload() {
    if (!blob) return
    setError('')
    setUploading(true)

    try {
      setProgress('Connecting to Sia...')
      await reconnect()

      const sdk = getSdk()

      const DATA_SHARDS = 10
      const PARITY_SHARDS = 20
      const total = encodedSize(blob.size, DATA_SHARDS, PARITY_SHARDS)
      let uploaded = 0
      setUploadPct(0)

      const obj = await sdk.upload(new PinnedObject(), blob.stream(), {
        dataShards: DATA_SHARDS,
        parityShards: PARITY_SHARDS,
        onShardUploaded: (p) => {
          uploaded += p.shardSize
          const pct = Math.min(99, Math.round((uploaded / total) * 100))
          setProgress(`Uploading... ${pct}%`)
          setUploadPct(pct)
        },
      })

      setProgress('Pinning to Sia network...')
      obj.updateMetadata(
        new TextEncoder().encode(
          JSON.stringify({
            name: `Recording ${new Date().toLocaleString()}`,
            date: new Date().toISOString(),
            mime: blob.type || 'video/webm',
            size: blob.size,
            expiryLabel: expiry.label,
            expiryMs: expiry.ms,
          })
        )
      )
      await sdk.pinObject(obj)

      // updateMetadata() above only mutates the local object. Push it to the
      // indexer so the history dashboard can read the name/expiry back later.
      await sdk.updateObjectMetadata(obj)

      setProgress('Generating share link...')
      const expires = new Date(Date.now() + expiry.ms)
      const url = sdk.shareObject(obj, expires)

      setShareUrl(url)
      setExpiresAt(expires)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
      setProgress('')
      setUploadPct(0)
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

  if (!blob) return null

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-950">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        {!shareUrl ? (
          <div className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">Upload & share</h1>
              <p className="text-sm text-gray-500">
                Your recording ({(blob.size / (1024 * 1024)).toFixed(1)} MB) will be
                encrypted in your browser and uploaded to the Sia network.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {/* Expiry selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Link expires after</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {EXPIRY_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setExpiry(opt)}
                      disabled={uploading}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                        expiry.label === opt.label
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {uploading ? progress || 'Uploading...' : 'Encrypt & upload'}
              </button>
              {uploading && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-all duration-300"
                    style={{ width: uploadPct + '%' }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/record')}
              disabled={uploading}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Back to recorder
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1 text-center">
              <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <IconCheck size={18} />
              </span>
              <h1 className="text-xl font-semibold tracking-tight">Your link is ready</h1>
              <p className="text-sm text-gray-500">Send it to anyone you want to watch this recording.</p>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <IconLink size={14} className="mt-0.5 shrink-0 text-gray-400" />
                <p className="break-all font-mono text-xs leading-relaxed text-gray-700">
                  {buildPlayUrl(shareUrl)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  onClick={() => window.open(buildPlayUrl(shareUrl), '_blank', 'noopener,noreferrer')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <IconExternal size={15} />
                  Watch
                </button>
              </div>
            </div>

            {/* Link details: exact expiry date + recording size */}
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white px-5 py-1 shadow-sm">
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-gray-500">Link expires</span>
                <span className="font-medium text-gray-900">
                  {expiry.label === 'Never'
                    ? 'Never'
                    : expiresAt?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              {expiry.label !== 'Never' && (
                <div className="flex items-center justify-between py-3 text-sm">
                  <span className="text-gray-500">Valid for</span>
                  <span className="text-gray-900">{expiry.label}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-gray-500">Size</span>
                <span className="text-gray-900">{(blob.size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>

            <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-gray-400">
              <IconLock size={13} className="mt-0.5 shrink-0" />
              <span>
                End-to-end encrypted. The decryption key travels in the link itself,
                never through a server.
              </span>
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/record')}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Record another
              </button>
              <button
                onClick={() => navigate('/history')}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                My recordings
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </main>
    </div>
  )
}
