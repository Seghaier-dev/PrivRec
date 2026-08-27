import { useState } from 'react'
import { loadIndexerUrl, saveIndexerUrl, hardReset } from '../lib/sia'
import { validateIndexerUrl } from '../lib/indexer'
import AppHeader from '../components/AppHeader'
import { IconAlert, IconSettings, IconExternal } from '../components/icons'

const DEFAULT_INDEXER = 'https://sia.storage'

export default function Settings() {
  const currentIndexer = loadIndexerUrl()
  const [indexerUrl, setIndexerUrl] = useState(currentIndexer)
  const [error, setError] = useState('')
  // Changing the indexer disconnects the account, so we ask twice:
  // idle -> confirm (button turns into an "are you sure?") -> done.
  const [confirming, setConfirming] = useState(false)

  const changed = indexerUrl.trim() !== currentIndexer

  function handleSave() {
    setError('')
    const trimmed = indexerUrl.trim()
    const validationError = validateIndexerUrl(trimmed)
    if (validationError) {
      setError(validationError)
      setConfirming(false)
      return
    }
    if (!confirming) {
      setConfirming(true)
      return
    }
    // The App Key is registered with one specific indexer, so switching means
    // starting over: wipe the key, then store the new URL (hardReset clears
    // the stored indexer too, so the order matters).
    hardReset()
    saveIndexerUrl(trimmed)
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Configure how PrivRec connects to the Sia network.
          </p>
        </div>

        {/* Indexer configuration */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-gray-300">
              <IconSettings size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">Indexer</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    currentIndexer === DEFAULT_INDEXER
                      ? 'border-gray-200 bg-gray-50 text-gray-500'
                      : 'border-gray-900 bg-gray-900 text-white'
                  }`}
                >
                  {currentIndexer === DEFAULT_INDEXER ? 'Default' : 'Custom'}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                The indexer is the Sia service that coordinates your uploads and
                share links. The default is the public{' '}
                <span className="font-mono text-xs">{DEFAULT_INDEXER}</span>, but
                you can point PrivRec at your own{' '}
                <a
                  href="https://github.com/SiaFoundation/indexd"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
                >
                  indexd
                </a>{' '}
                instance instead.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Indexer URL
            </label>
            <input
              type="url"
              value={indexerUrl}
              onChange={e => {
                setIndexerUrl(e.target.value)
                setConfirming(false)
                setError('')
              }}
              placeholder={DEFAULT_INDEXER}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm transition-colors focus:border-gray-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              HTTPS required (plain HTTP is allowed for localhost only).
            </p>
          </div>

          {changed && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <IconAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-amber-800">
                Changing the indexer disconnects this device. Your App Key is
                tied to the indexer that issued it, so you'll need your 12-word
                recovery phrase to reconnect, and recordings stored through a
                different indexer won't appear here.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!changed}
              className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-40 ${
                confirming
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {confirming ? 'Confirm: disconnect & switch indexer' : 'Change indexer'}
            </button>
            {changed && (
              <button
                onClick={() => {
                  setIndexerUrl(currentIndexer)
                  setConfirming(false)
                  setError('')
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Self-hosting pointer */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <IconExternal size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">Self-hosting</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                PrivRec is a static web app with no backend, so you can host it
                yourself on any static file host and pair it with your own
                indexer for a fully independent setup.
              </p>
              <a
                href="https://github.com/Seghaier-dev/PrivRec/blob/main/docs/self-hosting.md"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Read the self-hosting guide
                <IconExternal size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
