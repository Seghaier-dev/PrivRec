import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWithPhrase, completeRegistration, pollApproval, generateSeedPhrase, saveIndexerUrl, loadIndexerUrl } from '../lib/sia'
import { consumeReturnTo } from '../lib/redirect'

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

  function handleGenerate() {
    const p = generateSeedPhrase()
    setPhrase(p)
    setSavedChecked(false)
    setError('')
  }

  async function handleConnect() {
    setError('')

    let parsedIndexer
    try {
      parsedIndexer = new URL(indexerUrl)
    } catch {
      setError('Invalid indexer URL. Please enter a valid URL.')
      return
    }
    const isLocalIndexer = ['localhost', '127.0.0.1', '[::1]'].includes(parsedIndexer.hostname)
    if (parsedIndexer.protocol !== 'https:' && !(parsedIndexer.protocol === 'http:' && isLocalIndexer)) {
      setError('Indexer URL must use HTTPS.')
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

  const words = phrase.trim().split(/\s+/).filter(Boolean)
  const phraseValid = words.length === 12
  const canConnect = phraseValid && (tab === 'existing' || savedChecked)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center space-y-1">
          <h1 className="text-3xl font-medium">PrivRec</h1>
          <p className="text-sm text-gray-500">
            Record your screen or camera.<br/>
            Encrypted and stored on Sia.
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${tab === 'new' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
                onClick={() => { setTab('new'); setPhrase(''); setSavedChecked(false); setError('') }}
              >
                New account
              </button>
              <button
                className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${tab === 'existing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
                onClick={() => { setTab('existing'); setPhrase(''); setError('') }}
              >
                I have a phrase
              </button>
            </div>

            {tab === 'new' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Generate a recovery phrase. Write it down and store it safely —
                  it is the only way to access your recordings from a new device.
                </p>
                <button
                  onClick={handleGenerate}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Generate recovery phrase
                </button>
                {phraseValid && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {words.map((word, i) => (
                        <div key={i} className="bg-gray-100 rounded-lg px-3 py-2 text-sm flex gap-2">
                          <span className="text-gray-400 text-xs w-4">{i + 1}</span>
                          <span className="font-mono font-medium">{word}</span>
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={savedChecked}
                        onChange={e => setSavedChecked(e.target.checked)}
                        className="w-4 h-4 rounded"
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
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Enter your 12-word recovery phrase to connect your account.
                </p>
                <textarea
                  value={phrase}
                  onChange={e => { setPhrase(e.target.value); setError('') }}
                  placeholder="word1 word2 word3 ... word12"
                  rows={3}
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 resize-none"
                />
                {words.length > 0 && words.length < 12 && (
                  <p className="text-xs text-gray-400">
                    {words.length} / 12 words
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={!canConnect || loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>

            <div className="space-y-2">
              <button
                onClick={() => setShowIndexer(!showIndexer)}
                className="w-full py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                {showIndexer ? 'Use default indexer' : 'Use custom indexer'}
              </button>
              {showIndexer && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={indexerUrl}
                    onChange={e => setIndexerUrl(e.target.value)}
                    placeholder="https://your-indexer.example.com"
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <p className="text-xs text-gray-400">
                    Run your own indexer using the open-source
                    <a
                      href="https://github.com/SiaFoundation/indexd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 ml-1"
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
          <div className="space-y-5">
            <div className="border border-blue-100 bg-blue-50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <p className="text-sm font-semibold text-blue-800">Log in with Sia Storage</p>
              </div>
              <p className="text-sm text-blue-700 leading-relaxed">
                Open the Sia Storage page and log in to PrivRec.
                You'll be signed in automatically once you're done.
              </p>
            </div>
            <button
              onClick={() => {
                const w = 900, h = 700
                const left = Math.round((screen.width - w) / 2)
                const top = Math.round((screen.height - h) / 2)
                const popup = window.open(
                  approvalUrl,
                  'sia_approval',
                  `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
                )
                if (!popup) { window.location.href = approvalUrl; return }
                let done = false
                let timer

                function abort(msg) {
                  if (done) return
                  done = true
                  clearInterval(timer)
                  if (!popup.closed) popup.close()
                  setLoading(false)
                  setError(msg)
                }

                function finish() {
                  if (done) return
                  done = true
                  clearInterval(timer)
                  if (!popup.closed) popup.close()
                  handleApproved()
                }

                // If the popup closes before pollApproval resolves, the user
                // dismissed it — stop waiting and show an actionable message.
                timer = setInterval(() => {
                  if (popup.closed && !done) {
                    abort('The approval window was closed. Click the button again to retry.')
                  }
                }, 500)

                // A 5-minute timeout guards against the indexer never responding.
                const deadline = setTimeout(() => {
                  abort('Approval timed out. Please try again.')
                }, 5 * 60 * 1000)

                pollApproval()
                  .then(() => { clearTimeout(deadline); finish() })
                  .catch(() => { clearTimeout(deadline) })
              }}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Log in with Sia Storage
            </button>
            {loading && (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Signing in…</p>
              </div>
            )}
            <button
              onClick={() => { setStep(1); setError('') }}
              className="w-full py-3 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              ← Go back
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

      </div>
    </div>
  )
}
