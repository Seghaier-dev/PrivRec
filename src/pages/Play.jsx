import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { initSdk, reconnect } from '../lib/sia'
import { parseShareUrl } from '../lib/shareLink'
import { Logo } from '../components/AppHeader'
import { IconLock } from '../components/icons'

// Turn a raw SDK/network error into something a person can actually read.
// The Sia SDK throws things like:
//   Api("invalid signature for "GET" host "sia.storage/objects/.../shared"")
// which we never want to show as-is.
function friendlyError(err) {
  const msg = (err && err.message ? err.message : String(err)).toLowerCase()

  if (msg.includes('invalid signature') || msg.includes('expired') || msg.includes('unauthorized')) {
    return 'This link has expired or is no longer valid. Ask the sender for a new one.'
  }
  if (msg.includes('not found') || msg.includes('404') || msg.includes('no such object')) {
    return 'This recording could not be found. It may have been deleted or the link is wrong.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) {
    return 'Network problem while loading the video. Check your connection and try again.'
  }
  return 'Something went wrong loading this video. The link may be invalid or expired.'
}

export default function Play() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | downloading | ready | needsauth | error
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    let reader = null

    function pickStreamMime() {
      if (!('MediaSource' in window)) return ''
      const candidates = [
        'video/webm;codecs="vp9,opus"',
        'video/webm;codecs="vp8,opus"',
        'video/webm',
      ]
      for (const c of candidates) {
        if (MediaSource.isTypeSupported(c)) return c
      }
      return ''
    }

    async function playViaMSE(sdk, obj, mime) {
      const mediaSource = new MediaSource()
      objectUrl = URL.createObjectURL(mediaSource)

      if (!cancelled) { setVideoUrl(objectUrl); setStatus('ready') }

      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('MediaSource open timeout')), 10000)
        mediaSource.addEventListener('sourceopen', () => { clearTimeout(t); resolve() }, { once: true })
      })
      if (cancelled) return

      const sourceBuffer = mediaSource.addSourceBuffer(mime)

      // Append one chunk and wait for the buffer to finish before the next one.
      function appendChunk(chunk) {
        return new Promise((resolve, reject) => {
          sourceBuffer.addEventListener('updateend', resolve, { once: true })
          sourceBuffer.addEventListener('error', () => reject(new Error('appendBuffer failed')), { once: true })
          sourceBuffer.appendBuffer(chunk)
        })
      }

      const stream = sdk.download(obj)
      reader = new Response(stream).body.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (cancelled) return
        if (done) break
        await appendChunk(value)
        if (cancelled) return
      }

      if (mediaSource.readyState === 'open') mediaSource.endOfStream()
    }

    async function playViaBlob(sdk, obj) {
      // Fallback path for browsers without MediaSource: buffers the full video
      // before playback. The 'downloading' status keeps the spinner visible.
      if (!cancelled) setStatus('downloading')
      const stream = sdk.download(obj)
      const blob = await new Response(stream).blob()
      if (!cancelled) {
        objectUrl = URL.createObjectURL(blob)
        setVideoUrl(objectUrl)
        setStatus('ready')
      }
    }

    async function loadVideo() {
      try {
        // Reassemble the full share URL (base + fragment) the same way Upload
        // built it. See src/lib/shareLink.js for the round-trip contract.
        const shareUrl = parseShareUrl(window.location.search, window.location.hash)

        if (!shareUrl) {
          if (!cancelled) { setError('No share link provided.'); setStatus('error') }
          return
        }

        // Block browser-executable schemes that could run code if the SDK or any
        // downstream handler ever treated the URL as a navigation target.
        // We don't restrict to https-only because the Sia SDK may use its own
        // URI scheme or the app may run against a local http indexer.
        try {
          const proto = new URL(shareUrl).protocol
          if (proto === 'javascript:' || proto === 'data:' || proto === 'vbscript:') {
            throw new Error('bad scheme')
          }
        } catch {
          if (!cancelled) { setError('This share link is invalid.'); setStatus('error') }
          return
        }

        await initSdk()

        let sdk
        try {
          sdk = await reconnect()
        } catch {
          if (!cancelled) setStatus('needsauth')
          return
        }

        if (!cancelled) setStatus('downloading')

        const obj = await sdk.sharedObject(shareUrl)

        const mime = pickStreamMime()
        if (mime) {
          try {
            await playViaMSE(sdk, obj, mime)
            return
          } catch {
            // Streaming didn't work — clean up and fall back to a plain blob.
            if (cancelled) return
            try { if (reader) await reader.cancel() } catch { /* already closed */ }
            reader = null
            if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = '' }
          }
        }

        await playViaBlob(sdk, obj)
      } catch (e) {
        if (!cancelled) {
          setError(friendlyError(e))
          setStatus('error')
        }
      }
    }

    loadVideo()

    return () => {
      cancelled = true
      try { if (reader) reader.cancel() } catch { /* already closed */ }
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [retryCount])

  function handleConnect() {
    try {
      sessionStorage.setItem(
        'privrec_return_to',
        window.location.pathname + window.location.search + window.location.hash
      )
    } catch { /* sessionStorage unavailable */ }
    navigate('/signin')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" aria-label="PrivRec home"><Logo /></a>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <IconLock size={12} />
            End-to-end encrypted
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4 px-4 py-8 sm:px-6">
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-sm">
          {status === 'ready' && videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="h-full w-full object-contain"
            />
          ) : status === 'needsauth' ? (
            <div className="max-w-sm space-y-4 px-6 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-gray-300">
                <IconLock size={18} />
              </span>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-white">Connect your Sia account to watch</p>
                <p className="text-xs leading-relaxed text-gray-400">
                  This recording is end-to-end encrypted. You need your own Sia
                  account to stream and decrypt it.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200"
              >
                Connect account
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="max-w-sm space-y-4 px-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setStatus('loading')
                    setError('')
                    setVideoUrl('')
                    setRetryCount(c => c + 1)
                  }}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200"
                >
                  Try again
                </button>
                <a href="/" className="block text-xs text-gray-400 underline underline-offset-2 hover:text-gray-200">
                  Go to home page
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
              <p className="text-sm text-gray-300">
                {status === 'downloading' ? 'Decrypting and loading video...' : 'Initializing...'}
              </p>
              {status === 'downloading' && (
                <p className="text-xs text-gray-500">This may take a moment for large files</p>
              )}
            </div>
          )}
        </div>

        {status === 'ready' && (
          <p className="text-center text-xs text-gray-400">
            This video is end-to-end encrypted. Only people with this link can watch it.
          </p>
        )}
      </main>
    </div>
  )
}
