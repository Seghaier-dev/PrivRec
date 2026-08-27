import { useState, useEffect } from 'react'
import { getSdk, reconnect, loadIndexerUrl } from '../lib/sia'
import { formatBytes } from '../lib/recordings'
import AppHeader from '../components/AppHeader'
import { IconUser, IconVideo, IconCopy, IconCheck } from '../components/icons'

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="break-all text-right text-sm text-gray-800">{children}</span>
    </div>
  )
}

export default function Account() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)
  const [copiedKey, setCopiedKey] = useState(false)

  function copyKey() {
    navigator.clipboard.writeText(account.accountKey).then(() => {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    })
  }

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
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Account</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Your Sia storage account on this device.
            </p>
          </div>
          {status === 'ready' && account && (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                account.ready
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  account.ready ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {account.ready ? 'Ready' : 'Not ready'}
            </span>
          )}
        </div>

        {status === 'loading' && (
          <p className="text-sm text-gray-400">Loading account info...</p>
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

        {status === 'ready' && account && (
          <>
            {/* Storage usage */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-gray-300">
                  <IconVideo size={16} />
                </span>
                <div className="flex flex-1 items-baseline justify-between">
                  <p className="text-sm font-medium">Storage</p>
                  <p className="text-xs tabular-nums text-gray-400">
                    {formatBytes(account.pinnedData)} of {formatBytes(account.maxPinnedData)} ({usedPct}%)
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-gray-900'
                  }`}
                  style={{ width: usedPct + '%' }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Stored"
                value={formatBytes(account.pinnedData)}
                hint="Pinned to your account"
              />
              <StatCard
                label="Remaining"
                value={formatBytes(account.remainingStorage)}
                hint="Left before the quota"
              />
              <StatCard
                label="Quota"
                value={formatBytes(account.maxPinnedData)}
                hint="Maximum pinned data"
              />
              <StatCard
                label="On-network"
                value={formatBytes(account.pinnedSize)}
                hint="With coding overhead"
              />
            </div>

            {/* Account details */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                  <IconUser size={16} />
                </span>
                <p className="text-sm font-medium">Details</p>
              </div>
              <DetailRow label="Account key">
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-xs">{account.accountKey}</span>
                  <button
                    onClick={copyKey}
                    aria-label="Copy account key"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    {copiedKey ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </button>
                </span>
              </DetailRow>
              <DetailRow label="Last used">
                {account.lastUsed ? new Date(account.lastUsed).toLocaleString() : 'Never'}
              </DetailRow>
              <DetailRow label="Indexer">
                <span className="font-mono text-xs">{loadIndexerUrl()}</span>
              </DetailRow>
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
