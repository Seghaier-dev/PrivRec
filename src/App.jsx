import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { initSdk, hasStoredKey } from './lib/sia'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Recorder from './pages/Recorder'
import Upload from './pages/Upload'
import Play from './pages/Play'
import History from './pages/History'
import Account from './pages/Account'
import Settings from './pages/Settings'

function RequireAuth({ children }) {
  return hasStoredKey() ? children : <Navigate to="/signin" replace />
}

function App() {
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')

  useEffect(() => {
    initSdk()
      .then(() => setReady(true))
      .catch(err => {
        console.error('Sia WASM failed:', err)
        setInitError('Failed to load. Please refresh the page.')
      })
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-950">
        {initError ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-600">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600"
            >
              Refresh page
            </button>
          </div>
        ) : (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        )}
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={hasStoredKey() ? <Navigate to="/record" /> : <Onboarding />} />
        <Route path="/record" element={<RequireAuth><Recorder /></RequireAuth>} />
        <Route path="/upload" element={<RequireAuth><Upload /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        {/* /play is intentionally unauthenticated at the route level — anyone with
            a share link can reach it. Play.jsx itself redirects to onboarding if
            reconnect() fails, since decryption requires a Sia account. */}
        <Route path="/play" element={<Play />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
