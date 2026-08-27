import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWithPhrase, completeRegistration, pollApproval, generateSeedPhrase, saveIndexerUrl, loadIndexerUrl } from '../lib/sia'
import { consumeReturnTo } from '../lib/redirect'
import { validateIndexerUrl } from '../lib/indexer'
import { Logo } from '../components/AppHeader'
import { IconLock, IconArrowLeft } from '../components/icons'

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [tab, setTab] = useState('new')
  const [phrase, setPhrase] = useState('')
  const [savedChecked, setSavedChecked] = useState(false)
  const [approvalUrl, setApprovalUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showIndexer, setShowIndexer] = useState(false)
  const [indexerUrl, setIndexerUrl] = useState(loadIndexerUrl)
  // Lets the "Cancel" button stop an in-flight approval wait.
  const cancelApprovalRef = useRef(null)

  function handleGenerate() {
    const p = generateSeedPhrase()
    setPhrase(p)
    setSavedChecked(false)
    setError('')
  }

  async function handleConnect() {
    setError('')

    const indexerError = validateIndexerUrl(indexerUrl)
    if (indexerError) {
      setError(indexerError)
      return
    }

    setLoading(true)
    const previousIndexerUrl = loadIndexerUrl()

    try {
      saveIndexerUrl(indexerUrl)
      const result = await connectWithPhrase(phrase.trim())
      if (!result.needsApproval) {
        const to = consumeReturnTo()
        if (to) { window.location.href = to } else { navigate('/record') }
        return
      }
      setApprovalUrl(result.approvalUrl)
      setStep(2)
    } catch (e) {
      saveIndexerUrl(previousIndexerUrl)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApproved() {
    setError('')
    setLoading(true)
    try {
      await completeRegistration()
      setPhrase('')
      const to = consumeReturnTo()
      if (to) { window.location.href = to } else { navigate('/record') }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Open the approval popup and wait for the indexer to report approval.
  //
  // Deliberately does NOT watch popup.closed: the Sia Storage page can close
  // the popup right after approval (losing the race against our next poll),
  // and cross-origin-opener-policy can make .closed report true while the
  // window is still open. Both used to surface a bogus "window was closed"
  // error after a successful approval. Instead we rely on the poll itself,
  // a 5-minute deadline, and an explicit Cancel button.
  function startApproval() {
    setError('')
    setLoading(true)

    const w = 900, h = 700
    const left = Math.round((screen.width - w) / 2)
    const top = Math.round((screen.height - h) / 2)
    const popup = window.open(
      approvalUrl,
      'sia_approval',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )
    // Popup blocked — fall back to navigating this tab.
    if (!popup) { window.location.href = approvalUrl; return }

    let done = false

    function closePopup() {
      try { if (!popup.closed) popup.close() } catch { /* COOP may block access */ }
    }

    function abort(msg) {
      if (done) return
      done = true
      clearTimeout(deadline)
      cancelApprovalRef.current = null
      closePopup()
      setLoading(false)
      if (msg) setError(msg)
    }

    // Guards against the indexer never responding.
    const deadline = setTimeout(() => {
      abort('Approval timed out. Please try again.')
    }, 5 * 60 * 1000)

    cancelApprovalRef.current = () => abort('')

    pollApproval()
      .then(() => {
        if (done) return
        done = true
        clearTimeout(deadline)
        cancelApprovalRef.current = null
        closePopup()
        handleApproved()
      })
      .catch(e => {
        abort(e?.message || 'Something went wrong waiting for approval. Please try again.')
      })
  }

  const words = phrase.trim().split(/\s+/).filter(Boolean)
  const phraseValid = words.length === 12
  const canConnect = phraseValid && (tab === 'existing' || savedChecked)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10 text-gray-950">
      <div className="w-full max-w-md space-y-6">

        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {step === 1 ? 'Sign in to PrivRec' : 'One more step'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Record your screen or camera. Encrypted, stored on Sia.
            </p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            {/* Tabs */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                  tab === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
                onClick={() => { setTab('new'); setPhrase(''); setSavedChecked(false); setError('') }}
              >
                New account
              </button>
              <button
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                  tab === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
                onClick={() => { setTab('existing'); setPhrase(''); setError('') }}
              >
                I have a phrase
              </button>
            </div>

            {tab === 'new' && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-gray-500">
                  Generate a recovery phrase and write it down somewhere safe.
                  It's the only way to access your recordings from a new device.
                </p>
                {!phraseValid && (
                  <button
                    onClick={handleGenerate}
                    className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                  >
                    Generate recovery phrase
                  </button>
                )}
                {phraseValid && (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {words.map((word, i) => (
                        <div key={i} className="flex items-baseline gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                          <span className="w-4 text-right text-[11px] tabular-nums text-gray-400">{i + 1}</span>
                          <span className="truncate font-mono text-[13px] text-gray-800">{word}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleGenerate}
                      className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
                    >
                      Generate a different phrase
                    </button>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={savedChecked}
                        onChange={e => setSavedChecked(e.target.checked)}
                        className="h-4 w-4 rounded accent-gray-900"
                      />
                      <span className="text-sm text-gray-700">
                        I have written down my phrase
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}

            {tab === 'existing' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Enter your 12-word recovery phrase to connect your account.
                </p>
                <textarea
                  value={phrase}
                  onChange={e => { setPhrase(e.target.value); setError('') }}
                  placeholder="word1 word2 word3 ... word12"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm transition-colors focus:border-gray-400 focus:outline-none"
                />
                {words.length > 0 && words.length < 12 && (
                  <p className="text-xs tabular-nums text-gray-400">{words.length} / 12 words</p>
                )}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={!canConnect || loading}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowIndexer(!showIndexer)}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
              >
                {showIndexer ? 'Use default indexer' : 'Use a custom indexer'}
              </button>
              {showIndexer && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={indexerUrl}
                    onChange={e => setIndexerUrl(e.target.value)}
                    placeholder="https://your-indexer.example.com"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs transition-colors focus:border-gray-400 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400">
                    Run your own indexer with the open-source{' '}
                    <a
                      href="https://github.com/SiaFoundation/indexd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
                    >
                      indexd
                    </a>
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Approve PrivRec on Sia Storage</p>
              <p className="text-sm leading-relaxed text-gray-500">
                Open the Sia Storage page and log in to PrivRec.
                You'll be signed in here automatically once you're done.
              </p>
            </div>
            <button
              onClick={startApproval}
              disabled={loading}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Log in with Sia Storage
            </button>
            {loading && (
              <div className="flex items-center justify-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                <p className="text-sm text-gray-500">Waiting for approval...</p>
                <button
                  onClick={() => cancelApprovalRef.current?.()}
                  className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={() => { cancelApprovalRef.current?.(); setStep(1); setError('') }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <IconArrowLeft size={14} />
              Go back
            </button>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <IconLock size={12} />
          No servers of ours. Your videos are end-to-end encrypted.
        </p>

      </div>
    </div>
  )
}
