import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSdk, reconnect } from '../lib/sia'
import { PinnedObject, encodedSize } from '@siafoundation/sia-storage'
import { buildPlayUrl } from '../lib/shareLink'

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
    <div className="min-h-screen bg-gray-50 text-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        <h1 className="text-2xl font-medium text-center">Upload & share</h1>

        {!shareUrl ? (
          <>
            <p className="text-sm text-gray-500 text-center">
              Your recording will be encrypted and uploaded to Sia.
              Choose how long the share link stays active.
            </p>

            {/* Expiry selector */}
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Link expires after:</p>
              <div className="grid grid-cols-3 gap-2">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiry(opt)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      expiry.label === opt.label
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
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
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {uploading ? progress || 'Uploading...' : 'Upload & get share link'}
            </button>
            {uploading && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: uploadPct + '%' }}
                />
              </div>
            )}

            <button
              onClick={() => navigate('/record')}
              className="w-full py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              ← Back to recorder
            </button>
          </>
        ) : (
          <>
            <div className="bg-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-500">Your share link:</p>
              <p className="text-xs font-mono text-gray-700 break-all">{buildPlayUrl(shareUrl)}</p>
              <button
                onClick={copyLink}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
              <button
                onClick={() => window.open(buildPlayUrl(shareUrl), '_blank', 'noopener')}
                className="w-full py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                Watch in browser →
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              {expiry.label === 'Never' ? 'Never expires' : `Link expires: ${expiry.label} from now`}
            </p>
            <button
              onClick={() => navigate('/record')}
              className="w-full py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              ← Record another
            </button>
            <button
              onClick={() => navigate('/history')}
              className="w-full py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              My recordings →
            </button>
          </>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

      </div>
    </div>
  )
}
