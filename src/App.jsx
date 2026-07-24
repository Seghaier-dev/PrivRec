import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { initSdk, hasStoredKey } from './lib/sia'
import Onboarding from './pages/Onboarding'
import Recorder from './pages/Recorder'
import Upload from './pages/Upload'
import Play from './pages/Play'
import History from './pages/History'
import Account from './pages/Account'

function RequireAuth({ children }) {
  return hasStoredKey() ? children : <Navigate to="/" replace />
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
      <div className="min-h-screen bg-gray-50 text-gray-950 flex items-center justify-center">
        {initError ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-red-500">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Refresh page
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading...</p>
        )}
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={hasStoredKey() ? <Navigate to="/record" /> : <Onboarding />} />
        <Route path="/record" element={<RequireAuth><Recorder /></RequireAuth>} />
        <Route path="/upload" element={<RequireAuth><Upload /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
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
