import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSdk, reconnect, loadIndexerUrl } from '../lib/sia'
import { formatBytes } from '../lib/recordings'

function StatCard({ label, value, hint }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-medium mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right break-all">{children}</span>
    </div>
  )
}

export default function Account() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reconnect()
        const acct = await getSdk().account()
        if (cancelled) return
        setAccount(acct)
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

  // Percentage of the pinned-data quota in use, for the usage bar.
  const usedPct =
    account && account.maxPinnedData > 0
      ? Math.min(100, Math.round((account.pinnedData / account.maxPinnedData) * 100))
      : 0

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-lg font-semibold tracking-tight">PrivRec</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            My recordings
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
        <h1 className="text-2xl font-medium">Account</h1>

        {status === 'loading' && (
          <p className="text-sm text-gray-400">Loading account info...</p>
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

        {status === 'ready' && account && (
          <>
            {/* Storage usage bar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Storage used</p>
                <p className="text-xs text-gray-400">
                  {formatBytes(account.pinnedData)} of {formatBytes(account.maxPinnedData)} ({usedPct}%)
                </p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: usedPct + '%' }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Stored"
                value={formatBytes(account.pinnedData)}
                hint="Data pinned to your account"
              />
              <StatCard
                label="Remaining"
                value={formatBytes(account.remainingStorage)}
                hint="Space left before the quota"
              />
              <StatCard
                label="Quota"
                value={formatBytes(account.maxPinnedData)}
                hint="Maximum pinned data"
              />
              <StatCard
                label="On-network size"
                value={formatBytes(account.pinnedSize)}
                hint="After erasure-coding overhead"
              />
            </div>

            {/* Account details */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium mb-2">Details</p>
              <DetailRow label="Status">
                <span className={account.ready ? 'text-green-600' : 'text-amber-600'}>
                  {account.ready ? 'Ready' : 'Not ready'}
                </span>
              </DetailRow>
              <DetailRow label="Account key">
                <span className="font-mono text-xs">{account.accountKey}</span>
              </DetailRow>
              <DetailRow label="Last used">
                {account.lastUsed ? new Date(account.lastUsed).toLocaleString() : '—'}
              </DetailRow>
              <DetailRow label="Indexer">{loadIndexerUrl()}</DetailRow>
              {account.app && (
                <DetailRow label="Approved app">
                  {account.app.name}
                </DetailRow>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
